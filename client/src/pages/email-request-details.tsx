import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Mail, Loader2, Calendar, Send, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendGroupEmail } from "@/components/send-group-email";
import { Separator } from "@/components/ui/separator";

interface EmailRequest {
  id: number;
  groupId: number;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export default function EmailRequestDetailsPage() {
  const [, params] = useRoute<{ id: string }>("/email-requests/:id");
  const requestId = params ? parseInt(params.id) : 0;
  const { toast } = useToast();
  
  // Fetch email request details
  const { data: request, isLoading: isLoadingRequest } = useQuery<EmailRequest>({
    queryKey: ["/api/email-requests", requestId],
    queryFn: () => fetch(`/api/email-requests/${requestId}`).then(res => res.json()),
    enabled: requestId > 0,
  });
  
  // Fetch group details if we have a request
  const { data: group, isLoading: isLoadingGroup } = useQuery<ContactGroup>({
    queryKey: ["/api/contact-groups", request?.groupId],
    queryFn: () => fetch(`/api/contact-groups/${request?.groupId}`).then(res => {
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json().then(data => data.group);
    }),
    enabled: !!request?.groupId,
  });
  
  const isLoading = isLoadingRequest || isLoadingGroup;
  
  if (!requestId) {
    return (
      <div className="container mx-auto py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Ошибка: Запрос не найден</h1>
        <Link href="/contact-groups">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам контактов
          </Button>
        </Link>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!request) {
    return (
      <div className="container mx-auto py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Запрос не найден</h1>
        <p className="mb-4">Запрос с ID {requestId} не существует или был удален.</p>
        <Link href="/contact-groups">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам контактов
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link href={`/contact-groups/${request.groupId}`}>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группе контактов
          </Button>
        </Link>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{request.name}</h1>
            {request.description && (
              <p className="text-muted-foreground mt-1">{request.description}</p>
            )}
            <div className="flex items-center mt-2">
              {request.status === "pending" ? (
                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                  Ожидает отправки
                </Badge>
              ) : (
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                  Отправлено
                </Badge>
              )}
              <span className="text-sm text-muted-foreground ml-4">
                Создан: {format(new Date(request.createdAt), "dd.MM.yyyy HH:mm")}
              </span>
            </div>
          </div>
          
          {group && request.status === "pending" && (
            <SendGroupEmail
              groupId={group.id} 
              groupName={group.name}
              requestId={request.id}
            />
          )}
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <User className="h-5 w-5 mr-2 text-muted-foreground" />
            Информация о группе контактов
          </CardTitle>
        </CardHeader>
        <CardContent>
          {group ? (
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Название группы:</span>{" "}
                <span>{group.name}</span>
              </div>
              {group.description && (
                <div>
                  <span className="text-sm font-medium">Описание:</span>{" "}
                  <span>{group.description}</span>
                </div>
              )}
              <div>
                <Link href={`/contact-groups/${group.id}`}>
                  <Button variant="link" className="p-0 h-auto text-primary">
                    Просмотреть группу контактов
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Информация о группе недоступна</p>
          )}
        </CardContent>
      </Card>
      
      {request.status === "pending" ? (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Запрос ожидает отправки</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Этот запрос на отправку email был создан, но письмо еще не было отправлено.
                Нажмите кнопку "Отправить email" чтобы продолжить.
              </p>
              
              {group && (
                <SendGroupEmail
                  groupId={group.id} 
                  groupName={group.name}
                  requestId={request.id}
                  triggerButton={
                    <Button size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      Отправить email
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Send className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Email успешно отправлен</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Ваш email был успешно отправлен всем контактам в группе.
              </p>
              
              {group && (
                <Link href={`/contact-groups/${group.id}`}>
                  <Button variant="outline" size="lg">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Вернуться к группе контактов
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}