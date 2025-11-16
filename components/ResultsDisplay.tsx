
import React from 'react';
import { ValidationResult, ValidationDetail, ValidationStatus } from '../types';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DocumentTextIcon, ArrowPathIcon, ArrowDownTrayIcon } from './Icons';

interface ResultsDisplayProps {
  result: ValidationResult;
  fileName: string;
  onReset: () => void;
}

const statusConfig = {
  [ValidationStatus.PASS]: {
    icon: <CheckCircleIcon className="h-6 w-6 text-green-500" />,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800'
  },
  [ValidationStatus.FAIL]: {
    icon: <XCircleIcon className="h-6 w-6 text-red-500" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800'
  },
  [ValidationStatus.PARTIAL]: {
    icon: <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />,
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
    <li className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">{config.icon}</div>
        <div className="ml-3 flex-1">
          <div className="flex justify-between items-baseline">
            <h3 className={`text-sm font-medium ${config.textColor}`}>{detail.id}. {detail.requirement}</h3>
            <span className="text-xs text-gray-400 hidden sm:block">{detail.dianRule}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{detail.reason}</p>
          {detail.suggestion && (
            <div className="mt-2 text-sm text-gray-500 bg-gray-100 p-2 rounded-md">
              <span className="font-semibold">Sugerencia:</span> {detail.suggestion}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};


const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, fileName, onReset }) => {
    const isCompliant = result.overallStatus === 'COMPLIANT';
    const hasFailures = result.details.some(d => d.status === ValidationStatus.FAIL);

    const handleDownload = () => {
        const report = {
            fileName,
            validationTimestamp: new Date().toISOString(),
            ...result
        };
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `reporte-kila-${fileName}`;
        link.click();
    };

  return (
    <div className="space-y-8 animate-fade-in">
        <div className={`p-6 rounded-xl border ${isCompliant ? 'border-green-300 bg-white' : hasFailures ? 'border-red-300 bg-white' : 'border-amber-300 bg-white'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <DocumentTextIcon className="h-5 w-5" />
                        <span>{fileName}</span>
                    </div>
                    <h2 className={`text-2xl font-bold ${isCompliant ? 'text-green-600' : hasFailures ? 'text-red-600' : 'text-amber-600'}`}>
                        {isCompliant ? 'Factura Cumple con la Normativa' : 'Factura No Cumple'}
                    </h2>
                    <p className="mt-1 text-gray-600">{result.summary}</p>
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
                        Validar Otra
                    </button>
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Resultados Detallados del Análisis</h3>
            <div className="space-y-6">
                {Object.entries(validationGroups).map(([groupName, ids]) => (
                    <div key={groupName}>
                        <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">{groupName}</h4>
                        <ul className="space-y-3">
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
    </div>
  );
};

export default ResultsDisplay;
