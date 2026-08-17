'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { shipmentsApi, customersApi, carriersApi } from '@/lib/api';
import { toApiError } from '@/lib/api-client';
import { AppShell } from '@/components/shell/app-shell';
import { Card } from '@/components/shell/card';
import { SectionTitle } from '@/components/shell/card';

const schema = z.object({
  ref_number: z.string().min(1, 'Reference number is required'),
  transport_mode: z.enum(['ocean', 'air', 'road', 'rail']),
  shipper_id: z.string().min(1, 'Select a shipper'),
  carrier_id: z.string().min(1, 'Select a carrier'),
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  etd: z.string().optional(),
  eta: z.string().optional(),
  cargo_description: z.string().optional(),
  weight_kg: z.coerce.number().min(0).optional(),
  packages: z.coerce.number().min(0).optional(),
  incoterm: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [shipperQuery, setShipperQuery] = useState('');
  const [shipperResults, setShipperResults] = useState<{ id: string; name: string }[]>([]);
  const [showShippers, setShowShippers] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const searchShippers = async (q: string) => {
    setShipperQuery(q);
    if (q.length < 2) { setShipperResults([]); return; }
    try {
      const res = await customersApi.list({ search: q, limit: 10 });
      setShipperResults(res.items.map((c) => ({ id: c.id, name: c.name })));
      setShowShippers(true);
    } catch { setShipperResults([]); }
  };

  const selectShipper = (id: string, name: string) => {
    setValue('shipper_id', id);
    setShipperQuery(name);
    setShowShippers(false);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const shipment = await shipmentsApi.create(data);
      toast.success('Shipment created');
      router.push(`/shipments/${shipment.id}`);
    } catch (err) {
      const apiErr = toApiError(err as any);
      if (apiErr.fieldErrors) {
        for (const [field, msgs] of Object.entries(apiErr.fieldErrors)) {
          if (field in data) {
            // Set error on form field
          }
        }
        toast.error('Please fix the highlighted fields');
      } else {
        toast.error(apiErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-[#e9e9ef] bg-white px-3.5 py-2.5 text-[13px] outline-none transition focus:border-[#746ad1] focus:ring-2 focus:ring-[#e8e5f7]';

  return (
    <AppShell>
      <button onClick={() => router.push('/shipments')} className="mb-4 flex items-center gap-1.5 text-[12px] font-medium text-[#777884] hover:text-[#393945]">
        <ArrowLeft size={15} />Back to shipments
      </button>

      <SectionTitle>Create shipment</SectionTitle>

      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl">
        <Card>
          <h3 className="mb-4 font-display text-[15px] font-semibold">Shipment details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Reference number</label>
              <input {...register('ref_number')} className={inputCls} placeholder="FO-28491" />
              {errors.ref_number && <p className="mt-1 text-[11px] text-[#d45166]">{errors.ref_number.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Transport mode</label>
              <select {...register('transport_mode')} className={inputCls}>
                <option value="ocean">Ocean</option>
                <option value="air">Air</option>
                <option value="road">Road</option>
                <option value="rail">Rail</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Incoterm</label>
              <input {...register('incoterm')} className={inputCls} placeholder="FOB, CIF…" />
            </div>

            <div className="relative sm:col-span-2">
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Shipper</label>
              <input
                value={shipperQuery}
                onChange={(e) => searchShippers(e.target.value)}
                onFocus={() => shipperResults.length > 0 && setShowShippers(true)}
                className={inputCls}
                placeholder="Search customer…"
              />
              {showShippers && shipperResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#e9e9ef] bg-white shadow-lg">
                  {shipperResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectShipper(c.id, c.name)}
                      className="block w-full px-3.5 py-2.5 text-left text-[12px] hover:bg-[#f7f6fc]"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" {...register('shipper_id')} />
              {errors.shipper_id && <p className="mt-1 text-[11px] text-[#d45166]">{errors.shipper_id.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Carrier</label>
              <input {...register('carrier_id')} className={inputCls} placeholder="Carrier ID" />
              {errors.carrier_id && <p className="mt-1 text-[11px] text-[#d45166]">{errors.carrier_id.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Origin</label>
              <input {...register('origin')} className={inputCls} placeholder="Mumbai" />
              {errors.origin && <p className="mt-1 text-[11px] text-[#d45166]">{errors.origin.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Destination</label>
              <input {...register('destination')} className={inputCls} placeholder="Rotterdam" />
              {errors.destination && <p className="mt-1 text-[11px] text-[#d45166]">{errors.destination.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">ETD</label>
              <input type="datetime-local" {...register('etd')} className={inputCls} />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">ETA</label>
              <input type="datetime-local" {...register('eta')} className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Cargo description</label>
              <textarea {...register('cargo_description')} rows={2} className={inputCls} placeholder="General merchandise…" />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Weight (kg)</label>
              <input type="number" {...register('weight_kg')} className={inputCls} placeholder="0" />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#393945]">Packages</label>
              <input type="number" {...register('packages')} className={inputCls} placeholder="0" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button type="button" onClick={() => router.push('/shipments')} className="rounded-xl border border-[#e9e9ef] px-4 py-2.5 text-[12px] font-medium text-[#777884] hover:bg-[#f7f7fa]">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-xl bg-[#7068cf] px-5 py-2.5 text-[12px] font-semibold text-white shadow-[0_6px_14px_rgba(112,104,207,0.2)] disabled:opacity-60">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Creating…' : 'Create shipment'}
            </button>
          </div>
        </Card>
      </form>
    </AppShell>
  );
}
