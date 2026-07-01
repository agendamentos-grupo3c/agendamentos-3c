'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { brl } from '@/lib/orcamento';
import { maskBrPhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { contratanteSchema, type ContratanteValues } from '@/schemas/orcamento';

function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function Contratante({
  total,
  notice,
  onBack,
  onSubmit,
}: {
  total: number;
  notice?: string;
  onBack: () => void;
  onSubmit: (values: ContratanteValues) => void;
}) {
  const form = useForm<ContratanteValues>({
    resolver: zodResolver(contratanteSchema),
    mode: 'onTouched',
    defaultValues: {
      contratanteNome: '',
      contratanteEmail: '',
      contratanteTelefone: '',
      empresa: '',
      cnpj: '',
      idHubspot: '',
      idNegocio: '',
      formaPagamento: 'avista',
      observacoes: '',
    },
  });

  const forma = form.watch('formaPagamento');
  const parcelas = form.watch('parcelas');
  const valorParcela = forma === 'parcelado' && parcelas && parcelas >= 2 ? total / parcelas : null;

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Dados da proposta</CardTitle>
        <CardDescription>
          Total do orçamento: <span className="font-semibold text-foreground">R$ {brl(total)}</span>. Esses
          dados vão para a geração da proposta no ClickSign.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {notice}
          </p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="contratanteNome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do contratante</FormLabel>
                  <FormControl>
                    <Input placeholder="Quem assina o contrato" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contratanteEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contratante@empresa.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contratanteTelefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Razão social" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="00.000.000/0000-00"
                        {...field}
                        onChange={(e) => field.onChange(maskCnpj(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="idHubspot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID HubSpot (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="contato/vid" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idNegocio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do negócio (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="dealId" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="formaPagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de pagamento</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      {(['avista', 'parcelado'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={field.value === opt}
                          onClick={() => field.onChange(opt)}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            field.value === opt
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                              : 'border-input hover:border-foreground/30 hover:bg-secondary/50',
                          )}
                        >
                          {opt === 'avista' ? 'À vista' : 'Parcelado'}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {forma === 'parcelado' && (
              <FormField
                control={form.control}
                name="parcelas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parcelas</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="Ex.: 12"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    {valorParcela !== null && (
                      <p className="text-sm text-muted-foreground">
                        {parcelas}× de <span className="font-medium text-foreground">R$ {brl(Math.round(valorParcela))}</span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notas que vão na proposta." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onBack}>
                Voltar
              </Button>
              <Button type="submit">Enviar proposta</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
