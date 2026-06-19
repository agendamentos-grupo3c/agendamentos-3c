'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { maskBrPhone } from '@/lib/phone';
import { clientFormSchema, type ClientFormValues } from '@/schemas/clientForm';

const EMPTY: ClientFormValues = {
  companyName: '',
  clientName: '',
  integrationSummary: '',
  crmName: '',
  clientEmail: '',
  phone: '',
};

export function ClientForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: ClientFormValues;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? EMPTY,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do cliente</CardTitle>
        <CardDescription>Preencha os dados para agendar o kickoff da integração.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Acme Ltda." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Maria Souza" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="crmName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do CRM do cliente</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: HubSpot, Pipedrive…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail do cliente</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="cliente@empresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone do cliente</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="tel"
                      placeholder="42 99999-8888"
                      {...field}
                      onChange={(e) => field.onChange(maskBrPhone(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="integrationSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resumo do que precisam com a integração</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Descreva o que o cliente precisa integrar…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Continuar
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
