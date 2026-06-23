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
import type { Segment } from '@/lib/api';
import { cn } from '@/lib/utils';
import { maskBrPhone } from '@/lib/phone';
import { implantationFormSchema, type ImplantationFormValues } from '@/schemas/implantation';

const EMPTY: ImplantationFormValues = {
  companyName: '',
  clientName: '',
  clientEmail: '',
  clientId: '',
  phone: '',
  segment: 'enterprise',
};

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'middle', label: 'Middle' },
  { value: 'small', label: 'Small' },
  { value: 'evolux', label: 'Evolux' },
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

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Dados do cliente</CardTitle>
        <CardDescription>Preencha os dados do lead para agendar o treinamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="segment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segmento do cliente</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    <Input placeholder="ID do cliente na plataforma" {...field} />
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

            <Button type="submit" size="lg" className="w-full">
              Ver horários
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
