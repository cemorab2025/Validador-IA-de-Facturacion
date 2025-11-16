
import React, { useState, useCallback } from 'react';
import { validateInvoicesWithAI } from './services/geminiService';
import { ValidationResult, AppState, ValidationStatus } from './types';
import FileUpload from './components/FileUpload';
import ResultsDisplay from './components/ResultsDisplay';
import KilaLogo from './components/KilaLogo';
import Loader from './components/Loader';

const App: React.FC = () => {
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [appState, setAppState] = useState<AppState>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
      setError('Formato de archivo no válido. Por favor, sube únicamente archivos .JSON.');
      setAppState('error');
      return;
    }

    setAppState('loading');
    setFileName(file.name);
    setValidationResults(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const parsedJson = JSON.parse(fileContent);
        
        // Normalize input to always be an array for batch processing
        const invoices = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

        const results = await validateInvoicesWithAI(invoices);
        setValidationResults(results);
        setAppState('results');
      } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? `Error: ${err.message}` : 'An unknown error occurred during validation.';
        setError(`Fallo al procesar el lote de facturas. Asegúrate de que es un JSON válido que contiene una factura o una lista de facturas. ${errorMessage}`);
        setAppState('error');
      }
    };
    reader.onerror = () => {
        setError('Error al leer el archivo.');
        setAppState('error');
    };
    reader.readAsText(file);
  }, []);

  const handleReset = () => {
    setAppState('idle');
    setValidationResults(null);
    setFileName('');
    setError(null);
  };
  
  const getBackgroundColor = () => {
    if (appState === 'results' && validationResults) {
      const anyNonCompliant = validationResults.some(r => r.overallStatus === 'NON_COMPLIANT');
      if (anyNonCompliant) return 'bg-red-50';
      
      const anyPartials = validationResults.some(res => res.details.some(d => d.status === ValidationStatus.PARTIAL));
      if(anyPartials) return 'bg-amber-50'; // Though NON_COMPLIANT should catch this.

      return 'bg-green-50';
    }
    return 'bg-gray-50';
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${getBackgroundColor()}`}>
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <KilaLogo />
          <h1 className="hidden sm:block text-xl md:text-2xl font-bold text-gray-800 text-center">
            Validador IA de Facturas Comerciales
          </h1>
          <div className="w-24"></div> {/* Spacer */}
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
            {appState === 'idle' && (
                <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-2">Comienza la Validación</h2>
                    <p className="text-gray-500 mb-6">Sube un archivo JSON con una o varias facturas para que nuestra IA las analice según la normativa DIAN.</p>
                    <FileUpload onFileUpload={handleFileUpload} />
                </div>
            )}

            {appState === 'loading' && (
                <div className="text-center py-12">
                    <Loader />
                    <h2 className="text-xl font-semibold text-gray-700 mt-4">Analizando Lote de Facturas...</h2>
                    <p className="text-gray-500">{fileName}</p>
                    <p className="text-sm text-gray-400 mt-4">La IA está verificando cada requisito en todas las facturas. Esto puede tomar unos segundos.</p>
                </div>
            )}
            
            {appState === 'error' && (
                <div className="text-center">
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6" role="alert">
                        <p className="font-bold">Error en la Validación</p>
                        <p>{error}</p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-700 transition-colors"
                    >
                        Intentar de Nuevo
                    </button>
                </div>
            )}

            {appState === 'results' && validationResults && (
                <div>
                    <ResultsDisplay results={validationResults} fileName={fileName} onReset={handleReset} />
                </div>
            )}
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        <p>&copy; {new Date().getFullYear()} Kila. Potenciando el comercio internacional.</p>
      </footer>
    </div>
  );
};

export default App;
