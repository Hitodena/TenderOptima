import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Search, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ExcludedDomain {
  id: number;
  domain: string;
  reason: string;
  addedById: number;
  createdAt: string;
  addedBy?: {
    username: string;
  };
}

const reasonOptions = [
  'Маркетплейс/Агрегатор',
  'Информационный сайт/Блог',
  'Форум/Социальная сеть',
  'Спам/Низкое качество',
  'Государственный сайт',
  'Другое...'
];

const getReasonBadgeVariant = (reason: string) => {
  if (reason.includes('Маркетплейс')) return 'default';
  if (reason.includes('Информационный')) return 'secondary';
  if (reason.includes('Форум')) return 'outline';
  if (reason.includes('Спам')) return 'destructive';
  if (reason.includes('Государственный')) return 'secondary';
  return 'outline';
};

export default function ExcludedDomainsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [domain, setDomain] = useState('');

  // Fetch excluded domains
  const { data: excludedDomains = [], isLoading, error } = useQuery<ExcludedDomain[]>({
    queryKey: ['excluded-domains'],
    queryFn: async () => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/excluded-domains', {
        credentials: 'include',
        headers: {
          'X-Admin-Token': adminToken,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch excluded domains');
      }
      return response.json();
    },
  });

  // Add domain mutation
  const addDomainMutation = useMutation({
    mutationFn: async (data: { domain: string; reason: string }) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/excluded-domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to add domain');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excluded-domains'] });
      setDomain('');
      setSelectedReason('');
      setCustomReason('');
      toast({
        title: "Успех",
        description: "Домен успешно добавлен в стоп-лист",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Ошибка при добавлении домена: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete domain mutation
  const deleteDomainMutation = useMutation({
    mutationFn: async (id: number) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/excluded-domains/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-Admin-Token': adminToken,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to delete domain');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excluded-domains'] });
      toast({
        title: "Успех",
        description: "Домен успешно удален из стоп-листа",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Ошибка при удалении домена: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите домен",
        variant: "destructive",
      });
      return;
    }

    const finalReason = selectedReason === 'Другое...' ? customReason : selectedReason;
    if (!finalReason.trim()) {
      toast({
        title: "Ошибка",
        description: "Выберите или введите причину",
        variant: "destructive",
      });
      return;
    }

    addDomainMutation.mutate({
      domain: domain.trim(),
      reason: finalReason,
    });
  };

  const handleDelete = (id: number, domain: string) => {
    if (window.confirm(`Вы уверены, что хотите удалить домен "${domain}" из стоп-листа?`)) {
      deleteDomainMutation.mutate(id);
    }
  };

  // Filter domains based on search term
  const filteredDomains = excludedDomains.filter(domain =>
    domain.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.addedBy?.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Ошибка при загрузке данных: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Стоп-лист сайтов</h2>
        <p className="text-muted-foreground">
          Управление списком исключенных доменов из поисковой выдачи
        </p>
      </div>

      {/* Add Domain Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Добавить домен в стоп-лист
          </CardTitle>
          <CardDescription>
            Домены из стоп-листа будут автоматически исключены из результатов поиска
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Домен</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={addDomainMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Причина исключения</Label>
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите причину" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedReason === 'Другое...' && (
              <div className="space-y-2">
                <Label htmlFor="customReason">Укажите причину</Label>
                <Textarea
                  id="customReason"
                  placeholder="Введите причину исключения домена..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  disabled={addDomainMutation.isPending}
                />
              </div>
            )}

            <Button 
              type="submit" 
              disabled={addDomainMutation.isPending}
              className="w-full md:w-auto"
            >
              {addDomainMutation.isPending ? 'Добавление...' : 'Добавить в стоп-лист'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search and List */}
      <Card>
        <CardHeader>
          <CardTitle>Список исключенных доменов</CardTitle>
          <CardDescription>
            Всего доменов в стоп-листе: {excludedDomains.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Поиск по домену, причине или пользователю..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Загрузка...</p>
            </div>
          ) : filteredDomains.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'Домены не найдены' : 'Стоп-лист пуст'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Домен</TableHead>
                    <TableHead>Причина</TableHead>
                    <TableHead>Кем добавлено</TableHead>
                    <TableHead>Дата добавления</TableHead>
                    <TableHead className="w-[100px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-mono">{domain.domain}</TableCell>
                      <TableCell>
                        <Badge variant={getReasonBadgeVariant(domain.reason)}>
                          {domain.reason}
                        </Badge>
                      </TableCell>
                      <TableCell>{domain.addedBy?.username || 'Неизвестно'}</TableCell>
                      <TableCell>
                        {new Date(domain.createdAt).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(domain.id, domain.domain)}
                          disabled={deleteDomainMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}