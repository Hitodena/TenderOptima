import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Check,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  ArrowLeft
} from 'lucide-react';
import SupplierRequestGenerator from './SupplierRequestGenerator';

interface ComplianceItem {
  requirement_id: string;
  requirement_text: string;
  supplier_value: string;
  compliance_status: string;
  reasoning: string;
}

interface ComplianceResultsTableProps {
  data: ComplianceItem[];
  totalRequirements: number;
  requestName?: string;
}

export default function ComplianceResultsTable({
  data,
  totalRequirements,
  requestName
}: ComplianceResultsTableProps) {
  const [location, setLocation] = useLocation();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Нормализация статусов (для совместимости с разными форматами)
  const normalizeStatus = (status: string): 'compliant' | 'partial' | 'non_compliant' | 'missing' => {
    switch (status) {
      case 'compliant':
        return 'compliant';
      case 'partially-compliant':
      case 'partial':
        return 'partial';
      case 'non-compliant':
      case 'non_compliant':
        return 'non_compliant';
      case 'not-found':
      case 'missing':
        return 'missing';
      default:
        return 'missing';
    }
  };

  // Фильтрация и поиск
  const filteredData = data.filter(item => {
    const normalizedStatus = normalizeStatus(item.compliance_status);
    const matchesStatus = filterStatus === 'all' || normalizedStatus === filterStatus;
    const matchesSearch =
      item.requirement_id.toLowerCase().includes(searchText.toLowerCase()) ||
      item.requirement_text.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Статистика
  const stats = {
    compliant: data.filter(d => normalizeStatus(d.compliance_status) === 'compliant').length,
    partial: data.filter(d => normalizeStatus(d.compliance_status) === 'partial').length,
    non_compliant: data.filter(d => normalizeStatus(d.compliance_status) === 'non_compliant').length,
    missing: data.filter(d => normalizeStatus(d.compliance_status) === 'missing').length
  };

  const compliancePercent = Math.round(
    ((stats.compliant + stats.partial * 0.5) / totalRequirements) * 100
  );

  // Переключение расширения строк
  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  // Экспорт в CSV
  const exportToCSV = () => {
    const headers = [
      'Требование ID',
      'Требование',
      'Значение из КП',
      'Статус',
      'Объяснение'
    ];
    const rows = data.map(item => [
      item.requirement_id,
      item.requirement_text,
      item.supplier_value,
      normalizeStatus(item.compliance_status),
      item.reasoning
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row
          .map(cell => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'compliance-analysis.csv');
    link.click();
  };

  // Функция получения цвета статуса
  const getStatusColor = (
    status: 'compliant' | 'partial' | 'non_compliant' | 'missing'
  ) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-50 border-green-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      case 'non_compliant':
        return 'bg-red-50 border-red-200';
      case 'missing':
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: 'compliant' | 'partial' | 'non_compliant' | 'missing') => {
    switch (status) {
      case 'compliant':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'non_compliant':
        return <X className="w-5 h-5 text-red-600" />;
      case 'missing':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: 'compliant' | 'partial' | 'non_compliant' | 'missing') => {
    const labels: { [key: string]: string } = {
      compliant: 'Соответствует',
      partial: 'Частично',
      non_compliant: 'Не соответствует',
      missing: 'Не найдено'
    };
    return labels[status] || status;
  };

  return (
    <div className="w-full">
      {/* Заголовок с статистикой */}
      <div className="mb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {requestName ? `Результаты анализа для запроса "${requestName}"` : 'Результаты анализа'}
            </h2>
            <p className="text-sm text-gray-600">
              Найдено требований: <span className="font-semibold">{totalRequirements}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation('/analyze/technical')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <Download className="w-4 h-4" />
              Экспорт CSV
            </button>
            <SupplierRequestGenerator data={filteredData} />
          </div>
        </div>

        {/* Статистика в одну строку */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">{compliancePercent}%</span>
            <span className="text-sm text-gray-600">соответствия</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-green-600">{stats.compliant}</span>
              <span className="text-xs text-gray-600">Соответствует</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-yellow-600">{stats.partial}</span>
              <span className="text-xs text-gray-600">Частично</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-red-600">{stats.non_compliant}</span>
              <span className="text-xs text-gray-600">Не соответствует</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-600">{stats.missing}</span>
              <span className="text-xs text-gray-600">Не найдено</span>
            </div>
          </div>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className="flex gap-4 mb-4 flex-col sm:flex-row">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по требованиям..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="all">Все статусы</option>
          <option value="compliant">✓ Соответствует</option>
          <option value="partial">⚠ Частично</option>
          <option value="non_compliant">✗ Не соответствует</option>
          <option value="missing">? Не найдено</option>
        </select>
      </div>

      {/* Таблица */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {filteredData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Требования не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Требование
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Значение из КП
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    Действие
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const normalizedStatus = normalizeStatus(item.compliance_status);
                  return (
                    <React.Fragment key={item.requirement_id}>
                      <tr
                        className={`border-b border-gray-200 hover:bg-gray-50 transition ${getStatusColor(
                          normalizedStatus
                        )}`}
                      >
                        <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {item.requirement_id}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 max-w-xs truncate">
                          {item.requirement_text}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {item.supplier_value}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusIcon(normalizedStatus)}
                            <span className="text-xs font-medium text-gray-700">
                              {getStatusLabel(normalizedStatus)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => toggleRow(item.requirement_id)}
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:bg-gray-200 rounded transition"
                          >
                            {expandedRows.has(item.requirement_id) ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Развернутая строка с деталями */}
                      {expandedRows.has(item.requirement_id) && (
                        <tr className="bg-white border-b border-gray-200">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">
                                  Полное требование:
                                </h4>
                                <p className="text-gray-700 leading-relaxed">
                                  {item.requirement_text}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">
                                  Значение из предложения:
                                </h4>
                                <p className="text-gray-700 leading-relaxed bg-blue-50 p-3 rounded">
                                  {item.supplier_value}
                                </p>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">
                                  Объяснение анализа:
                                </h4>
                                <p className="text-gray-700 leading-relaxed">
                                  {item.reasoning}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Информация о количестве записей */}
      <div className="mt-4 text-sm text-gray-600">
        Показано {filteredData.length} из {data.length} требований
      </div>
    </div>
  );
}

