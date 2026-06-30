'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import * as React from 'react';
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
import { api, type ImplantationProduct, type Segment } from '@/lib/api';
import { cn } from '@/lib/utils';
import { maskBrPhone } from '@/lib/phone';
import { implantationFormSchema, type ImplantationFormValues } from '@/schemas/implantation';

type ClientCheck = 'idle' | 'loading' | 'found' | 'notfound' | 'error';

const EMPTY: ImplantationFormValues = {
  companyName: '',
  clientName: '',
  clientEmail: '',
  clientId: '',
  phone: '',
  segment: 'enterprise',
  product: 'discador',
};

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'middle', label: 'Middle' },
  { value: 'small', label: 'Small' },
];

const PRODUCTS: { value: ImplantationProduct; label: string }[] = [
  { value: 'discador', label: 'Discador' },
  { value: 'omni', label: 'Omni' },
  { value: 'ura', label: 'URA' },
  { value: 'pabx', label: 'PABX' },
];

export function ImplantationForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: ImplantationFormValues;
  onSubmit: (values: ImplantationFormValues) => void;
}) {
  const form = useForm<ImplantationFormValues>({
    resolver: zodResolver(implantationFormSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? EMPTY,
  });

  // Validação do lead pelo ID do cliente: procura um negócio na etapa "Boas
  // Vindas" dos funis. Só libera o agendamento quando encontrado.
  const clientId = form.watch('clientId');
  const [check, setCheck] = React.useState<ClientCheck>('idle');

  React.useEffect(() => {
    const id = clientId.trim();
    if (!id) {
      setCheck('idle');
      return;
    }
    setCheck('loading');
    let active = true;
    const t = setTimeout(() => {
      api
        .validateImplantationClient(id)
        .then((r) => active && setCheck(r.found ? 'found' : 'notfound'))
        .catch(() => active && setCheck('error'));
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [clientId]);

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Dados do cliente</CardTitle>
        <CardDescription>Preencha os dados do lead para agendar o treinamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => {
              if (check !== 'found') return;
              onSubmit(values);
            })}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="segment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento do cliente</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-3 gap-2">
                      {SEGMENTS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          aria-pressed={field.value === value}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            field.value === value
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                              : 'border-input text-muted-foreground hover:border-foreground/30 hover:bg-secondary/50 hover:text-foreground',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto da implantação</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PRODUCTS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          aria-pressed={field.value === value}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            field.value === value
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                              : 'border-input text-muted-foreground hover:border-foreground/30 hover:bg-secondary/50 hover:text-foreground',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID do cliente</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input className="pr-9" placeholder="ID do cliente na plataforma" {...field} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {check === 'loading' && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                        {check === 'found' && (
                          <CheckCircle2 className="size-4 text-green-500 dark:text-green-300" />
                        )}
                        {(check === 'notfound' || check === 'error') && (
                          <XCircle className="size-4 text-destructive" />
                        )}
                      </span>
                    </div>
                  </FormControl>
                  {check === 'notfound' && (
                    <p className="text-sm text-destructive">
                      Lead não encontrado na etapa Boas Vindas de nenhum funil. Confira o ID.
                    </p>
                  )}
                  {check === 'error' && (
                    <p className="text-sm text-destructive">
                      Não foi possível validar o ID agora. Tente novamente.
                    </p>
                  )}
                  {check === 'found' && (
                    <p className="text-sm text-green-500 dark:text-green-300">Lead encontrado.</p>
                  )}
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

            <Button type="submit" size="lg" className="w-full" disabled={check !== 'found'}>
              Ver horários
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
