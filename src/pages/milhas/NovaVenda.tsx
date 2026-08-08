import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionModal } from '@/components/transactions/TransactionModal';

export default function NovaVenda() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nova Venda</h1>
        <Button onClick={() => setOpen(true)}>Nova Transação</Button>
      </div>

      <TransactionModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
