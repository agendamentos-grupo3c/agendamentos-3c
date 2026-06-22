'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Construction, PlugZap, Rocket, type LucideIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { maskBrPhone } from '@/lib/phone';
import { clientFormSchema, type ClientFormValues } from '@/schemas/clientForm';

const EMPTY: ClientFormValues = {
  companyName: '',
  clientName: '',
  integrationSummary: '',
  crmName: '',
  clientEmail: '',
  phone: '',
  demandType: 'integracao',
};

// Primeira escolha do formulário (seção 7): define qual fluxo abrir.
type DemandKind = 'integracoes_automacoes' | 'implantacao';

const DEMAND_OPTIONS: { kind: DemandKind; label: string; icon: LucideIcon }[] = [
  { kind: 'integracoes_automacoes', label: 'Integrações / Automações', icon: PlugZap },
  { kind: 'implantacao', label: 'Implantação', icon: Rocket },
];

export function ClientForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: ClientFormValues;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const [kind, setKind] = React.useState<DemandKind>('integracoes_automacoes');
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    mode: 'onTouched',
    defaultValues: defaultValues ?? EMPTY,
  });

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Novo agendamento</CardTitle>
        <CardDescription>Escolha o tipo de demanda para começar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Tipo de demanda</p>
          <div className="grid grid-cols-1 gap-2 rounded-2xl bg-secondary p-1.5 sm:grid-cols-2">
            {DEMAND_OPTIONS.map(({ kind: k, label, icon: Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  kind === k
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-primary/40'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {kind === 'implantacao' ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Construction className="size-6" />
            </span>
            <p className="font-medium">Formulário em construção</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              O time de Implantação terá um formulário próprio em breve. Por enquanto, use o fluxo de
              Integrações / Automações.
            </p>
          </div>
        ) : (
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

              <Button type="submit" size="lg" className="w-full">
                Continuar
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
