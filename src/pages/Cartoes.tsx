import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus, Trash2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const cartoesIniciais = [
  { id: '1', name: 'Latam Pass Black', bank: 'Itaú', limit: 45000, consumido: 38500 },
  { id: '2', name: 'C6 Carbon', bank: 'C6 Bank', limit: 25000, consumido: 8400 }
];

export default function Cartoes() {
  const [cartoes] = useState(cartoesIniciais);

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto text-zinc-100">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="text-emerald-500" /> Cartões</h1>
        <Button className="bg-[#10b981]">+ Novo Cartão</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cartoes.map((cartao) => (
          <Link key={cartao.id} to={`/financas/cartoes/${cartao.id}`} className="block">
            <Card className="bg-[#141417] p-6 border-white/5 hover:border-emerald-500 transition-all cursor-pointer">
              <div className="flex justify-between mb-4">
                <span className="text-[10px] text-zinc-500 uppercase">{cartao.bank}</span>
                <div className="flex gap-2">
                   <Edit2 className="w-4 h-4 text-zinc-500 hover:text-white" />
                   <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-500" />
                </div>
              </div>
              <CardTitle className="mb-4">{cartao.name}</CardTitle>
              <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(cartao.consumido/cartao.limit)*100}%` }} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}