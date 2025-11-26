import React, { useState, useMemo } from 'react';
import { Mail, Copy, Download, CheckCircle2, AlertCircle, XCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

interface ComplianceItem {
  requirement_id: string;
  requirement_text: string;
  supplier_value: string;
  compliance_status: string;
  reasoning: string;
}

interface SupplierRequestGeneratorProps {
  data: ComplianceItem[];
}

export default function SupplierRequestGenerator({ data }: SupplierRequestGeneratorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set());
  const [selectedNonCompliant, setSelectedNonCompliant] = useState<Set<string>>(new Set());
  const [selectedPartial, setSelectedPartial] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Нормализация статусов
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

  // Фильтрация данных по статусам
  const missingItems = useMemo(() => 
    data.filter(item => normalizeStatus(item.compliance_status) === 'missing'),
    [data]
  );
  
  const nonCompliantItems = useMemo(() => 
    data.filter(item => normalizeStatus(item.compliance_status) === 'non_compliant'),
    [data]
  );
  
  const partialItems = useMemo(() => 
    data.filter(item => normalizeStatus(item.compliance_status) === 'partial'),
    [data]
  );

  // Инициализация выбора всех элементов при открытии модали
  React.useEffect(() => {
    if (isOpen) {
      setSelectedMissing(new Set(missingItems.map(item => item.requirement_id)));
      setSelectedNonCompliant(new Set(nonCompliantItems.map(item => item.requirement_id)));
      setSelectedPartial(new Set(partialItems.map(item => item.requirement_id)));
    }
  }, [isOpen, missingItems, nonCompliantItems, partialItems]);

  // Форматирование текста письма в HTML
  const formatLetterAsHTML = (text: string): string => {
    const lines = text.split('\n');
    const result: string[] = [];
    let inNonCompliantItem = false;
    let inPartialItem = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Заголовок
      if (line === 'О несоответствии предложения техническим требованиям') {
        result.push('<h1 class="text-xl font-bold text-gray-900 mb-4">О несоответствии предложения техническим требованиям</h1>');
        continue;
      }
      
      // Заголовки секций
      if (line === 'Несоответствующие параметры:' || line === 'Требуют уточнения/дополнения:') {
        if (inNonCompliantItem) result.push('</div>');
        if (inPartialItem) result.push('</div>');
        inNonCompliantItem = false;
        inPartialItem = false;
        result.push(`<h2 class="text-base font-bold text-gray-900 mt-6 mb-4 pt-4 border-t border-gray-200">${line}</h2>`);
        continue;
      }
      
      // Недостающие параметры - заголовки
      if (line === 'Просим предоставить уточнения по отсутствующим в предложении данным.') {
        result.push('<p class="font-semibold text-gray-800 mb-2">Просим предоставить уточнения по отсутствующим в предложении данным.</p>');
        continue;
      }
      if (line === 'В вашем предложении данные отсутствуют ответы на следующие параметры технического задания:') {
        result.push('<p class="text-gray-700 mb-4">В вашем предложении данные отсутствуют ответы на следующие параметры технического задания:</p>');
        continue;
      }
      
      // Нумерованные списки недостающих параметров (общая нумерация)
      const missingMatch = line.match(/^(\d+)\. пункт ([\d.]+) технического задания: (.+?);/);
      if (missingMatch) {
        result.push(`<div class="mb-3 pl-4 py-1"><p class="text-gray-800"><span class="font-semibold text-gray-900">${missingMatch[1]}. пункт ${missingMatch[2]} технического задания:</span> <span class="text-gray-700">${missingMatch[3]};</span></p></div>`);
        continue;
      }
      
      // Нумерованные списки несоответствующих параметров (общая нумерация)
      const nonCompliantMatch = line.match(/^(\d+)\. По пункту ([\d.]+):/);
      if (nonCompliantMatch) {
        if (inNonCompliantItem) result.push('</div>');
        inNonCompliantItem = true;
        inPartialItem = false;
        result.push(`<div class="mb-4 pl-4 mt-4 py-2"><p class="font-semibold text-gray-900 mb-2">${nonCompliantMatch[1]}. По пункту ${nonCompliantMatch[2]}:</p>`);
        continue;
      }
      
      if (inNonCompliantItem) {
        if (line.startsWith('   Требование: "')) {
          const match = line.match(/^   Требование: "(.+?)"/);
          if (match) {
            result.push(`<p class="text-gray-800 mt-2 ml-4"><span class="font-medium text-gray-700">Требование:</span> <span class="text-gray-700">"${match[1]}"</span></p>`);
            continue;
          }
        }
        if (line.startsWith('   Предложено: "')) {
          const match = line.match(/^   Предложено: "(.+?)"/);
          if (match) {
            result.push(`<p class="text-gray-600 mt-1 ml-4"><span class="font-medium text-gray-600">Предложено:</span> <span class="text-gray-600">"${match[1]}"</span></p>`);
            continue;
          }
        }
        if (line.startsWith('   Причина отклонения: ')) {
          const reason = line.replace('   Причина отклонения: ', '');
          result.push(`<p class="text-orange-700 mt-2 ml-4 font-medium"><span class="font-semibold">Причина отклонения:</span> ${reason}</p></div>`);
          inNonCompliantItem = false;
          continue;
        }
      }
      
      // Нумерованные списки частично соответствующих (общая нумерация)
      const partialMatch = line.match(/^(\d+)\. Пункт ([\d.]+):/);
      if (partialMatch) {
        if (inPartialItem) result.push('</div>');
        if (inNonCompliantItem) result.push('</div>');
        inPartialItem = true;
        inNonCompliantItem = false;
        result.push(`<div class="mb-4 pl-4 mt-4 py-2"><p class="font-semibold text-gray-900 mb-2">${partialMatch[1]}. Пункт ${partialMatch[2]}:</p>`);
        continue;
      }
      
      if (inPartialItem) {
        if (line.startsWith('   Требуется: "')) {
          const match = line.match(/^   Требуется: "(.+?)"/);
          if (match) {
            result.push(`<p class="text-gray-800 mt-2 ml-4"><span class="font-medium text-gray-700">Требуется:</span> <span class="text-gray-700">"${match[1]}"</span></p>`);
            continue;
          }
        }
        if (line.startsWith('   Предложено: "')) {
          const match = line.match(/^   Предложено: "(.+?)"/);
          if (match) {
            result.push(`<p class="text-gray-600 mt-1 ml-4"><span class="font-medium text-gray-600">Предложено:</span> <span class="text-gray-600">"${match[1]}"</span></p>`);
            continue;
          }
        }
        if (line.startsWith('   Необходимо: ')) {
          const needed = line.replace('   Необходимо: ', '');
          result.push(`<p class="text-blue-700 mt-2 ml-4 font-medium"><span class="font-semibold">Необходимо:</span> ${needed}</p></div>`);
          inPartialItem = false;
          continue;
        }
      }
      
      // Обычные параграфы
      if (line === 'Проведён анализ вашего предложения по соответствию техническому заданию.') {
        result.push('<p class="text-gray-700 mb-3">Проведён анализ вашего предложения по соответствию техническому заданию.</p>');
        continue;
      }
      if (line === 'Выявлены следующие замечания и требуемые уточнения:') {
        result.push('<p class="text-gray-700 mb-4">Выявлены следующие замечания и требуемые уточнения:</p>');
        continue;
      }
      if (line.startsWith('Просим предоставить дополненное/уточненное предложение не позже')) {
        result.push(`<p class="text-gray-800 mt-6 mb-3 font-medium">${line}</p>`);
        continue;
      }
      if (line === 'С уважением,') {
        result.push('<p class="text-gray-800 mt-6 mb-1">С уважением,</p>');
        continue;
      }
      if (line === '[Наименование организации]') {
        result.push('<p class="text-gray-700 mb-1">[Наименование организации]</p>');
        continue;
      }
      if (line.match(/^\d{1,2} [а-я]+ \d{4}$/)) {
        result.push(`<p class="text-gray-600 text-sm">${line}</p>`);
        continue;
      }
      
      // Пустые строки
      if (line === '') {
        continue;
      }
      
      // Остальной текст
      result.push(`<p class="text-gray-700 mb-2">${line}</p>`);
    }
    
    // Закрываем открытые теги
    if (inNonCompliantItem) result.push('</div>');
    if (inPartialItem) result.push('</div>');
    
    return '<div class="prose prose-sm max-w-none">' + result.join('') + '</div>';
  };

  // Генерация текста письма
  const generateLetterText = useMemo(() => {
    const selectedMissingItems = missingItems.filter(item => selectedMissing.has(item.requirement_id));
    const selectedNonCompliantItems = nonCompliantItems.filter(item => selectedNonCompliant.has(item.requirement_id));
    const selectedPartialItems = partialItems.filter(item => selectedPartial.has(item.requirement_id));

    const today = new Date();
    const deadlineDate = new Date(today);
    deadlineDate.setDate(today.getDate() + 5);
    const deadlineStr = deadlineDate.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const currentDateStr = today.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    let letter = 'О несоответствии предложения техническим требованиям\n\n';
    letter += 'Проведён анализ вашего предложения по соответствию техническому заданию.\n\n';
    letter += 'Выявлены следующие замечания и требуемые уточнения:\n\n';

    // Общий счетчик для нумерации всех пунктов
    let globalIndex = 0;

    // Секция "Недостающие параметры"
    if (selectedMissingItems.length > 0) {
      letter += 'Просим предоставить уточнения по отсутствующим в предложении данным.\n\n';
      letter += 'В вашем предложении данные отсутствуют ответы на следующие параметры технического задания:\n\n';
      selectedMissingItems.forEach((item) => {
        globalIndex++;
        letter += `${globalIndex}. пункт ${item.requirement_id} технического задания: ${item.requirement_text};\n\n`;
      });
    }

    // Секция "Несоответствующие параметры"
    if (selectedNonCompliantItems.length > 0) {
      letter += 'Несоответствующие параметры:\n\n';
      selectedNonCompliantItems.forEach((item) => {
        globalIndex++;
        letter += `${globalIndex}. По пункту ${item.requirement_id}:\n`;
        letter += `   Требование: "${item.requirement_text}"\n`;
        letter += `   Предложено: "${item.supplier_value}"\n`;
        letter += `   Причина отклонения: ${item.reasoning}\n\n`;
      });
    }

    // Секция "Уточнения"
    if (selectedPartialItems.length > 0) {
      letter += 'Требуют уточнения/дополнения:\n\n';
      selectedPartialItems.forEach((item) => {
        globalIndex++;
        letter += `${globalIndex}. Пункт ${item.requirement_id}:\n`;
        letter += `   Требуется: "${item.requirement_text}"\n`;
        letter += `   Предложено: "${item.supplier_value}"\n`;
        letter += `   Необходимо: ${item.reasoning}\n\n`;
      });
    }

    letter += `Просим предоставить дополненное/уточненное предложение не позже ${deadlineStr}.\n\n`;
    letter += 'С уважением,\n';
    letter += '[Наименование организации]\n';
    letter += currentDateStr;

    return letter;
  }, [selectedMissing, selectedNonCompliant, selectedPartial, missingItems, nonCompliantItems, partialItems]);

  // Подсчёт выбранных элементов
  const totalSelected = selectedMissing.size + selectedNonCompliant.size + selectedPartial.size;
  const totalAvailable = missingItems.length + nonCompliantItems.length + partialItems.length;

  // Обработчики выбора
  const toggleMissing = (id: string) => {
    const newSet = new Set(selectedMissing);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMissing(newSet);
  };

  const toggleNonCompliant = (id: string) => {
    const newSet = new Set(selectedNonCompliant);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedNonCompliant(newSet);
  };

  const togglePartial = (id: string) => {
    const newSet = new Set(selectedPartial);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPartial(newSet);
  };

  // Выбрать всё / Снять всё
  const toggleAllMissing = () => {
    if (selectedMissing.size === missingItems.length) {
      setSelectedMissing(new Set());
    } else {
      setSelectedMissing(new Set(missingItems.map(item => item.requirement_id)));
    }
  };

  const toggleAllNonCompliant = () => {
    if (selectedNonCompliant.size === nonCompliantItems.length) {
      setSelectedNonCompliant(new Set());
    } else {
      setSelectedNonCompliant(new Set(nonCompliantItems.map(item => item.requirement_id)));
    }
  };

  const toggleAllPartial = () => {
    if (selectedPartial.size === partialItems.length) {
      setSelectedPartial(new Set());
    } else {
      setSelectedPartial(new Set(partialItems.map(item => item.requirement_id)));
    }
  };

  // Копирование в буфер обмена
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateLetterText);
      setCopied(true);
      toast({
        title: "Скопировано!",
        description: "Текст письма скопирован в буфер обмена",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать текст",
        variant: "destructive",
      });
    }
  };

  // Экспорт в Word
  const exportToWord = async () => {
    try {
      const selectedMissingItems = missingItems.filter(item => selectedMissing.has(item.requirement_id));
      const selectedNonCompliantItems = nonCompliantItems.filter(item => selectedNonCompliant.has(item.requirement_id));
      const selectedPartialItems = partialItems.filter(item => selectedPartial.has(item.requirement_id));

      const today = new Date();
      const deadlineDate = new Date(today);
      deadlineDate.setDate(today.getDate() + 5);
      const deadlineStr = deadlineDate.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      const currentDateStr = today.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      const paragraphs: Paragraph[] = [
        new Paragraph({
          text: "О несоответствии предложения техническим требованиям",
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "Проведён анализ вашего предложения по соответствию техническому заданию.",
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "Выявлены следующие замечания и требуемые уточнения:",
          spacing: { after: 400 },
        }),
      ];

      // Общий счетчик для нумерации всех пунктов
      let globalIndex = 0;

      // Секция "Недостающие параметры"
      if (selectedMissingItems.length > 0) {
        paragraphs.push(
          new Paragraph({
            text: "Просим предоставить уточнения по отсутствующим в предложении данным.",
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            text: "В вашем предложении данные отсутствуют ответы на следующие параметры технического задания:",
            spacing: { after: 200 },
          })
        );
        selectedMissingItems.forEach((item) => {
          globalIndex++;
          paragraphs.push(
            new Paragraph({
              text: `${globalIndex}. пункт ${item.requirement_id} технического задания: ${item.requirement_text};`,
              spacing: { after: 200 },
            })
          );
        });
      }

      // Секция "Несоответствующие параметры"
      if (selectedNonCompliantItems.length > 0) {
        paragraphs.push(
          new Paragraph({
            text: "Несоответствующие параметры:",
            spacing: { before: 200, after: 200 },
          })
        );
        selectedNonCompliantItems.forEach((item) => {
          globalIndex++;
          paragraphs.push(
            new Paragraph({
              text: `${globalIndex}. По пункту ${item.requirement_id}:`,
              spacing: { after: 100 },
            }),
            new Paragraph({
              text: `Требование: "${item.requirement_text}"`,
              spacing: { after: 100 },
              indent: { left: 400 },
            }),
            new Paragraph({
              text: `Предложено: "${item.supplier_value}"`,
              spacing: { after: 100 },
              indent: { left: 400 },
            }),
            new Paragraph({
              text: `Причина отклонения: ${item.reasoning}`,
              spacing: { after: 200 },
              indent: { left: 400 },
            })
          );
        });
      }

      // Секция "Уточнения"
      if (selectedPartialItems.length > 0) {
        paragraphs.push(
          new Paragraph({
            text: "Требуют уточнения/дополнения:",
            spacing: { before: 200, after: 200 },
          })
        );
        selectedPartialItems.forEach((item) => {
          globalIndex++;
          paragraphs.push(
            new Paragraph({
              text: `${globalIndex}. Пункт ${item.requirement_id}:`,
              spacing: { after: 100 },
            }),
            new Paragraph({
              text: `Требуется: "${item.requirement_text}"`,
              spacing: { after: 100 },
              indent: { left: 400 },
            }),
            new Paragraph({
              text: `Предложено: "${item.supplier_value}"`,
              spacing: { after: 100 },
              indent: { left: 400 },
            }),
            new Paragraph({
              text: `Необходимо: ${item.reasoning}`,
              spacing: { after: 200 },
              indent: { left: 400 },
            })
          );
        });
      }

      paragraphs.push(
        new Paragraph({
          text: `Просим предоставить дополненное/уточненное предложение не позже ${deadlineStr}.`,
          spacing: { before: 400, after: 400 },
        }),
        new Paragraph({
          text: "С уважением,",
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "[Наименование организации]",
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: currentDateStr,
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Запрос_поставщику_${today.toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Успешно",
        description: "Документ Word создан и скачан",
      });
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать документ Word",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-slate-900 hover:bg-slate-800 text-white border-0"
        >
          <Mail className="w-4 h-4 mr-2" />
          Создать запрос к поставщику
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[1400px] w-[95vw] h-[95vh] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Генератор запроса к поставщику</DialogTitle>
          <DialogDescription>
            Выберите требования для включения в письмо. Выбрано {totalSelected} из {totalAvailable} требований.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Левая часть - чекбоксы (35%) */}
          <div className="w-[35%] flex flex-col min-h-0">
            <Tabs 
              defaultValue={
                missingItems.length > 0 ? "missing" : 
                nonCompliantItems.length > 0 ? "non_compliant" : 
                "partial"
              } 
              className="w-full h-full flex flex-col"
            >
              <TabsList className={`grid w-full flex-shrink-0 mb-2 ${
                [missingItems.length, nonCompliantItems.length, partialItems.length].filter(l => l > 0).length === 3 ? 'grid-cols-3' :
                [missingItems.length, nonCompliantItems.length, partialItems.length].filter(l => l > 0).length === 2 ? 'grid-cols-2' :
                'grid-cols-1'
              }`}>
                {missingItems.length > 0 && (
                  <TabsTrigger value="missing" className="text-xs">
                    Не найдено ({missingItems.length})
                  </TabsTrigger>
                )}
                {nonCompliantItems.length > 0 && (
                  <TabsTrigger value="non_compliant" className="text-xs">
                    Не соответствует ({nonCompliantItems.length})
                  </TabsTrigger>
                )}
                {partialItems.length > 0 && (
                  <TabsTrigger value="partial" className="text-xs">
                    Частично ({partialItems.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {missingItems.length > 0 && (
                  <TabsContent value="missing" className="absolute inset-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <Label className="text-sm">Не найдено</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllMissing}
                        className="text-xs h-7"
                      >
                        {selectedMissing.size === missingItems.length ? 'Снять всё' : 'Выбрать всё'}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-0">
                    {missingItems.map((item) => (
                      <div key={item.requirement_id} className="flex items-start gap-2 p-2 border rounded w-full">
                        <Checkbox
                          id={`missing-${item.requirement_id}`}
                          checked={selectedMissing.has(item.requirement_id)}
                          onCheckedChange={() => toggleMissing(item.requirement_id)}
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`missing-${item.requirement_id}`}
                            className="text-xs cursor-pointer block break-words whitespace-normal overflow-visible"
                          >
                            <span className="font-medium">{item.requirement_id}:</span> {item.requirement_text}
                          </Label>
                        </div>
                      </div>
                    ))}
                    </div>
                  </TabsContent>
                )}

                {nonCompliantItems.length > 0 && (
                  <TabsContent value="non_compliant" className="absolute inset-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <Label className="text-sm">Не соответствует</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllNonCompliant}
                        className="text-xs h-7"
                      >
                        {selectedNonCompliant.size === nonCompliantItems.length ? 'Снять всё' : 'Выбрать всё'}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-0">
                    {nonCompliantItems.map((item) => (
                      <div key={item.requirement_id} className="flex items-start gap-2 p-2 border rounded w-full">
                        <Checkbox
                          id={`non_compliant-${item.requirement_id}`}
                          checked={selectedNonCompliant.has(item.requirement_id)}
                          onCheckedChange={() => toggleNonCompliant(item.requirement_id)}
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`non_compliant-${item.requirement_id}`}
                            className="text-xs cursor-pointer block break-words whitespace-normal overflow-visible"
                          >
                            <div className="break-words whitespace-normal">
                              <span className="font-medium">{item.requirement_id}:</span> {item.requirement_text}
                            </div>
                            <div className="text-gray-500 mt-1 break-words whitespace-normal">
                              Предложено: {item.supplier_value}
                            </div>
                            {item.reasoning && (
                              <div className="text-orange-600 mt-1 break-words whitespace-normal font-medium">
                                Причина отклонения: {item.reasoning}
                              </div>
                            )}
                          </Label>
                        </div>
                      </div>
                    ))}
                    </div>
                  </TabsContent>
                )}

                {partialItems.length > 0 && (
                  <TabsContent value="partial" className="absolute inset-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      <Label className="text-sm">Частично</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleAllPartial}
                        className="text-xs h-7"
                      >
                        {selectedPartial.size === partialItems.length ? 'Снять всё' : 'Выбрать всё'}
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-0">
                    {partialItems.map((item) => (
                      <div key={item.requirement_id} className="flex items-start gap-2 p-2 border rounded w-full">
                        <Checkbox
                          id={`partial-${item.requirement_id}`}
                          checked={selectedPartial.has(item.requirement_id)}
                          onCheckedChange={() => togglePartial(item.requirement_id)}
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`partial-${item.requirement_id}`}
                            className="text-xs cursor-pointer block break-words whitespace-normal overflow-visible"
                          >
                            <div className="break-words whitespace-normal">
                              <span className="font-medium">{item.requirement_id}:</span> {item.requirement_text}
                            </div>
                            <div className="text-gray-500 mt-1 break-words whitespace-normal">
                              Предложено: {item.supplier_value}
                            </div>
                            {item.reasoning && (
                              <div className="text-blue-600 mt-1 break-words whitespace-normal font-medium">
                                Необходимо: {item.reasoning}
                              </div>
                            )}
                          </Label>
                        </div>
                      </div>
                    ))}
                    </div>
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </div>

          {/* Правая часть - текст письма (65%) */}
          <div className="w-[65%] flex flex-col">
            <div className="flex items-center justify-between mb-3 gap-2">
              <Label className="text-sm whitespace-nowrap">Текст письма</Label>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="text-xs whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Копировать
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToWord}
                  className="text-xs whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Скачать .docx
                </Button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4 bg-white border rounded-md text-sm leading-relaxed"
              style={{ 
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.6'
              }}
              dangerouslySetInnerHTML={{ __html: formatLetterAsHTML(generateLetterText) }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

