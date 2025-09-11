import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Mail, Clock, Loader2, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CreateEmailRequest } from "@/components/create-email-request";

interface EmailRequest {
  id: number;
  groupId: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface EmailRequestListProps {
  groupId: number;
  groupName: string;
}

export function EmailRequestList({ groupId, groupName }: EmailRequestListProps) {
  const [tab, setTab] = useState<string>("all");
  
  const { data: emailRequests, isLoading, isError } = useQuery<EmailRequest[]>({
    queryKey: [`/api/contact-groups/${groupId}/email-requests`],
    queryFn: () => fetch(`/api/contact-groups/${groupId}/email-requests`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch email requests');
        }
        return res.json();
      }),
    retry: false
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  
  // Если запросов нет, не показываем ничего особенного
  if (!emailRequests || emailRequests.length === 0) {
    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold"> </h2>
          {/* Кнопка "Создать рассылку" удалена по запросу пользователя */}
        </div>
        
      </div>
    );
  }

  const filteredRequests = tab === "all" 
    ? emailRequests 
    : emailRequests.filter(request => request.status === tab);

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Email-рассылки</h2>
        {/* Кнопка "Создать рассылку" удалена по запросу пользователя */}
      </div>
      
      <Tabs defaultValue="all" value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="pending">Ожидают отправки</TabsTrigger>
          <TabsTrigger value="sent">Отправленные</TabsTrigger>
        </TabsList>
        
        <TabsContent value={tab} className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequests.map((request) => (
              <Card key={request.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{request.name}</CardTitle>
                      {request.description && <CardDescription>{request.description}</CardDescription>}
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>
                      Создан: {format(new Date(request.createdAt), "dd.MM.yyyy HH:mm")}
                    </span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-end">
                    {request.status === "pending" ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        asChild
                      >
                        <a href={`/email-requests/${request.id}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Отправить
                        </a>
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        asChild
                      >
                        <a href={`/email-requests/${request.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Просмотреть
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="flex items-center border-orange-200 bg-orange-50 text-orange-700">
          <Clock className="h-3 w-3 mr-1" />
          Ожидает отправки
        </Badge>
      );
    case "sent":
      return (
        <Badge variant="outline" className="flex items-center border-green-200 bg-green-50 text-green-700">
          <Mail className="h-3 w-3 mr-1" />
          Отправлено
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      );
  }
}