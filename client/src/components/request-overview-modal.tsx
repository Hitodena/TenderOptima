import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Info } from "lucide-react"
import { format } from "date-fns"
import { type SearchRequest, type RequestSupplier, type SupplierResponse } from "@shared/schema"

interface RequestOverviewModalProps {
  request: SearchRequest
  requestSuppliers: RequestSupplier[]
  supplierResponses: SupplierResponse[]
  onStatusUpdate: (id: number, status: string) => void
  isUpdatingStatus: boolean
}

export function RequestOverviewModal({
  request,
  requestSuppliers,
  supplierResponses,
  onStatusUpdate,
  isUpdatingStatus
}: RequestOverviewModalProps) {
  const [open, setOpen] = useState(false)

  const formattedDate = request?.createdAt 
    ? format(new Date(request.createdAt), 'dd.MM.yyyy')
    : "Unknown date"

  // Calculate statistics
  const uniqueContactedSuppliers = new Set(requestSuppliers.map(rs => rs.supplierEmail)).size
  const uniqueSupplierEmails = new Set(supplierResponses.map(r => r.supplierEmail)).size
  const responseRate = uniqueContactedSuppliers > 0 ? Math.round((uniqueSupplierEmails / uniqueContactedSuppliers) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted/50">
          <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          <span className="sr-only">Показать общую информацию</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Общая информация о запросе</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <h4 className="font-medium text-sm mb-2">{request.productName}</h4>
              <CardDescription className="text-sm">Создано: {formattedDate}</CardDescription>
              <CardDescription className="text-sm">Запрос: № {request?.id || 'N/A'}</CardDescription>
              <CardDescription className="text-sm">Код запроса: REQ-{request?.orderNumber || 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div>
                <h3 className="font-medium text-sm">Описание</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.productDescription || "Нет описания"}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium text-sm">Статус</h3>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`px-3 py-1 rounded text-xs font-medium ${
                    request.status === "completed"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {request.status === "completed" ? "Завершено" : "Активно"}
                  </span>
                  <div className="flex gap-2">
                    {request.status !== "completed" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-muted-foreground border-muted-foreground/30 hover:bg-muted/50"
                        onClick={() => onStatusUpdate(request.id, "completed")}
                        disabled={isUpdatingStatus}
                      >
                        Отметить как завершенное
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-muted-foreground border-muted-foreground/30 hover:bg-muted/50"
                        onClick={() => onStatusUpdate(request.id, "active")}
                        disabled={isUpdatingStatus}
                      >
                        Сделать активным
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <h4 className="font-medium text-sm">Статистика</h4>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-lg font-semibold">{uniqueContactedSuppliers}</p>
                  <p className="text-xs text-muted-foreground">Отправлено запросов</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-lg font-semibold">{uniqueSupplierEmails}</p>
                  <p className="text-xs text-muted-foreground">Получено ответов</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-lg font-semibold">{responseRate}%</p>
                  <p className="text-xs text-muted-foreground">конверсия</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
