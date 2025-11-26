import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ComplianceResult {
  requirement_id: string
  requirement_text: string
  supplier_value: string
  compliance_status: string
  reasoning: string
}

export default function AnalyzeComplianceGemini() {
  const [, setLocation] = useLocation()
  const [tzFile, setTzFile] = useState<File | null>(null)
  const [kpFile, setKpFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<ComplianceResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'pending' | 'completed'>('idle')
  const [requestId, setRequestId] = useState<number | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleTzUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTzFile(e.target.files[0])
      setError(null)
    }
  }

  const handleKpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setKpFile(e.target.files[0])
      setError(null)
    }
  }

  // Очистка polling при размонтировании компонента
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const analyzeDocuments = async () => {
    if (!tzFile || !kpFile) {
      setError("Необходимо загрузить оба файла")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    setAnalysisStatus('idle')

    const formData = new FormData()
    formData.append("technicalSpecification", tzFile)
    formData.append("commercialOffer", kpFile)

    try {
      const response = await fetch("/api/analyze-gemini", {
        method: "POST",
        credentials: 'include',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ошибка при анализе документов")
      }

      if (data.requestId) {
        setRequestId(data.requestId)
        setAnalysisStatus('pending')
        
        // Показываем сообщение
        alert('Файлы загружены! Результат будет готов в течение 2 часов. Мы отправим уведомление на email.')
        
        // Начинаем polling (проверяем статус каждую минуту)
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/analyze-gemini/${data.requestId}`, {
              credentials: 'include'
            })
            const statusData = await statusResponse.json()
            
            if (statusData.success && statusData.data.status === 'completed') {
              setAnalysisStatus('completed')
              if (statusData.data.result) {
                setResult(statusData.data.result)
                // Перенаправляем на страницу результатов
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current)
                  pollIntervalRef.current = null
                }
                setLocation(`/analysis/results?requestId=${data.requestId || requestId}`)
              }
            }
          } catch (pollError) {
            console.error('Ошибка при проверке статуса:', pollError)
          }
        }, 60000) // Каждую минуту
      } else {
        // Старый формат - результат сразу доступен
        setResult(data.data)
        setAnalysisStatus('completed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
      setAnalysisStatus('idle')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "compliant": return "text-green-600 bg-green-50"
      case "non-compliant": return "text-red-600 bg-red-50"
      case "partially-compliant": return "text-yellow-600 bg-yellow-50"
      case "not-found": return "text-gray-600 bg-gray-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "compliant": return "✅ Соответствует"
      case "non-compliant": return "❌ Не соответствует"
      case "partially-compliant": return "⚠️ Частично соответствует"
      case "not-found": return "❓ Не найдено"
      default: return status
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Тест: Анализ через Gemini API
          </CardTitle>
          <CardDescription>
            Экспериментальная версия с прямым вызовом Gemini (без Vertex AI Search).
            Анализирует все пункты ТЗ без ограничений.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Загрузка ТЗ */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Техническое задание (ТЗ)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleTzUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              {tzFile && (
                <span className="flex items-center gap-1 text-green-600 text-sm whitespace-nowrap">
                  <CheckCircle2 className="h-4 w-4" />
                  {tzFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Загрузка КП */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Коммерческое предложение (КП)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleKpUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              {kpFile && (
                <span className="flex items-center gap-1 text-green-600 text-sm whitespace-nowrap">
                  <CheckCircle2 className="h-4 w-4" />
                  {kpFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Кнопка анализа */}
          <Button
            onClick={analyzeDocuments}
            disabled={!tzFile || !kpFile || isAnalyzing}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загружаем файлы...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Анализировать
              </>
            )}
          </Button>

          {/* Статус обработки */}
          {analysisStatus === 'pending' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Файлы загружены. Анализ выполняется. Результат будет готов в течение 2 часов.
                {requestId && ` (Запрос #${requestId})`}
                <br />
                <span className="text-sm text-gray-500 mt-1 block">
                  Проверяем статус каждую минуту...
                </span>
                {requestId && (
                  <Button
                    onClick={() => setLocation(`/analysis/results?requestId=${requestId}`)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Открыть страницу результатов
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Ошибки */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Результат */}
          {result && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Результаты анализа
                </h3>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Найдено требований: {result.length}
                  </span>
                  {requestId && (
                    <Button
                      onClick={() => setLocation(`/analysis/results?requestId=${requestId}`)}
                      variant="default"
                      size="sm"
                    >
                      Открыть в таблице
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {result.map((item, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {item.requirement_id}
                        </CardTitle>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(item.compliance_status)}`}>
                          {getStatusLabel(item.compliance_status)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Требование:</span>
                        <p className="text-gray-700 mt-1">{item.requirement_text}</p>
                      </div>
                      <div>
                        <span className="font-medium">Значение из КП:</span>
                        <p className="text-gray-700 mt-1">{item.supplier_value}</p>
                      </div>
                      <div>
                        <span className="font-medium">Обоснование:</span>
                        <p className="text-gray-600 mt-1">{item.reasoning}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

