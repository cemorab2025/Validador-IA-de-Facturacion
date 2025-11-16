
import React, { useState, useMemo } from 'react';
import { ValidationResult, ValidationDetail, ValidationStatus } from '../types';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DocumentTextIcon, ArrowPathIcon, ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface ResultsDisplayProps {
  results: ValidationResult[];
  fileName: string;
  onReset: () => void;
}

type FilterStatus = 'all' | 'non_compliant' | 'compliant';

const statusConfig = {
  [ValidationStatus.PASS]: {
    icon: <CheckCircleIcon className="h-5 w-5 text-green-500" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800'
  },
  [ValidationStatus.FAIL]: {
    icon: <XCircleIcon className="h-5 w-5 text-red-500" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800'
  },
  [ValidationStatus.PARTIAL]: {
    icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800'
  },
};

const validationGroups: { [key: string]: number[] } = {
  'Información General y de las Partes': [1, 2, 3, 4, 5],
  'Descripción de la Mercancía y Valores': [6, 7, 8],
  'Condiciones Comerciales y Otros': [9, 10, 11, 12, 13, 14],
};

const ValidationItem: React.FC<{ detail: ValidationDetail }> = ({ detail }) => {
  const config = statusConfig[detail.status];
  return (
    <li className={`p-3 rounded-md border ${config.borderColor} ${config.bgColor}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
        <div className="ml-3 flex-1">
          <div className="flex justify-between items-baseline">
            <h3 className={`text-sm font-medium ${config.textColor}`}>{detail.id}. {detail.requirement}</h3>
            <span className="text-xs text-gray-400 hidden sm:block">{detail.dianRule}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{detail.reason}</p>
          {detail.suggestion && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
              <span className="font-semibold">Sugerencia:</span> {detail.suggestion}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

const InvoiceAccordion: React.FC<{ result: ValidationResult }> = ({ result }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isCompliant = result.overallStatus === 'COMPLIANT';

    return (
        <div className={`border rounded-lg ${isCompliant ? 'bg-white' : 'bg-red-50/50'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3">
                    {isCompliant ? <CheckCircleIcon className="h-6 w-6 text-green-500"/> : <XCircleIcon className="h-6 w-6 text-red-500"/>}
                    <div>
                        <span className="font-semibold text-gray-800">Factura #{result.invoiceId}</span>
                        <p className={`text-sm ${isCompliant ? 'text-gray-500' : 'text-red-700'}`}>{result.summary}</p>
                    </div>
                </div>
                {isOpen ? <ChevronUpIcon className="h-5 w-5 text-gray-500"/> : <ChevronDownIcon className="h-5 w-5 text-gray-500"/>}
            </button>
            {isOpen && (
                 <div className="px-4 pb-4 animate-fade-in-fast">
                    <div className="space-y-4 border-t pt-4">
                        {Object.entries(validationGroups).map(([groupName, ids]) => (
                            <div key={groupName}>
                                <h4 className="text-sm font-semibold text-gray-600 mb-2">{groupName}</h4>
                                <ul className="space-y-2">
                                    {result.details
                                        .filter(d => ids.includes(d.id))
                                        .sort((a, b) => a.id - b.id)
                                        .map((detail) => (
                                            <ValidationItem key={detail.id} detail={detail} />
                                        ))
                                    }
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, fileName, onReset }) => {
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

    const summary = useMemo(() => {
        const total = results.length;
        const nonCompliantCount = results.filter(r => r.overallStatus === 'NON_COMPLIANT').length;
        return {
            total,
            nonCompliantCount,
            compliantCount: total - nonCompliantCount,
        };
    }, [results]);

    const filteredResults = useMemo(() => {
        switch (activeFilter) {
            case 'non_compliant':
                return results.filter(r => r.overallStatus === 'NON_COMPLIANT');
            case 'compliant':
                return results.filter(r => r.overallStatus === 'COMPLIANT');
            case 'all':
            default:
                return results;
        }
    }, [results, activeFilter]);

    const handleDownload = () => {
        const report = {
            fileName,
            validationTimestamp: new Date().toISOString(),
            summary,
            results,
        };
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `reporte-lote-kila-${fileName}`;
        link.click();
    };

    const isBatchCompliant = summary.nonCompliantCount === 0;

  return (
    <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className={`p-6 rounded-xl border ${isBatchCompliant ? 'border-green-300 bg-white' : 'border-red-300 bg-white'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <DocumentTextIcon className="h-5 w-5" />
                        <span>{fileName}</span>
                    </div>
                    <h2 className={`text-2xl font-bold ${isBatchCompliant ? 'text-green-600' : 'text-red-600'}`}>
                        {isBatchCompliant ? 'Lote Válido' : 'Lote con Inconsistencias'}
                    </h2>
                    <p className="mt-1 text-gray-600">
                        Se analizaron <strong>{summary.total}</strong> facturas. 
                        <strong> {summary.compliantCount}</strong> cumplen con la normativa y 
                        <strong> {summary.nonCompliantCount}</strong> presentan inconsistencias.
                    </p>
                </div>
                 <div className="flex flex-col sm:flex-row gap-3 self-start sm:self-center">
                    <button
                        onClick={handleDownload}
                        className="flex items-center justify-center gap-2 bg-white text-cyan-700 border border-cyan-600 font-bold py-2 px-4 rounded-lg hover:bg-cyan-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                    >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        Descargar Reporte
                    </button>
                    <button
                        onClick={onReset}
                        className="flex items-center justify-center gap-2 bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                    >
                        <ArrowPathIcon className="h-5 w-5" />
                        Validar Otro Lote
                    </button>
                </div>
            </div>
        </div>

        {/* Filters and Results */}
        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Análisis por Factura</h3>
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveFilter('all')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeFilter === 'all' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Todas <span className="bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 ml-1">{summary.total}</span>
                    </button>
                    <button onClick={() => setActiveFilter('non_compliant')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeFilter === 'non_compliant' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        No Cumplen <span className={`rounded-full px-2 py-0.5 ml-1 ${activeFilter === 'non_compliant' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'}`}>{summary.nonCompliantCount}</span>
                    </button>
                    <button onClick={() => setActiveFilter('compliant')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeFilter === 'compliant' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Cumplen <span className={`rounded-full px-2 py-0.5 ml-1 ${activeFilter === 'compliant' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'}`}>{summary.compliantCount}</span>
                    </button>
                </nav>
            </div>
            
            <div className="space-y-3">
                {filteredResults.length > 0 ? (
                    filteredResults.map(result => <InvoiceAccordion key={result.invoiceId} result={result} />)
                ) : (
                    <div className="text-center py-10 px-4 border-2 border-dashed rounded-lg">
                        <p className="text-gray-500">No hay facturas que coincidan con este filtro.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default ResultsDisplay;
