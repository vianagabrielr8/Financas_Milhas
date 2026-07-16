import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plane, CreditCard, Wallet, ShieldCheck, BarChart3, ArrowUpRight, Banknote, Target, Percent, TrendingUp, TrendingDown } from 'lucide-react';
import { useMilesBalance, usePayableInstallments, useReceivableInstallments, useAccounts, useSales } from '@/hooks/useSupabaseData';
import { formatCPM, formatCurrency, formatNumber } from '@/utils/financeLogic';
import { format, addMonths, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, Area, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const MARKET_PRICES: Record<string, number> = { 'LATAM PASS': 25.50, 'SMILES': 15.50, 'ESFERA': 30.00, 'LIVELO': 35.00, 'AZUL': 21.00, 'C6 BANK': 35.00, 'ITAU': 35.00 };

const CustomCard = ({ title, value, subtitle, icon: Icon, variant = 'default' }: any) => {
  const styles = {
    default: { border: 'border-white/5', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
    success: { border: 'border-white/5', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
    destructive: { border: 'border-white/5', iconBg: 'bg-red-500/10', iconColor: 'text-red-500' },
    warning: { border: 'border-white/5', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
  }[variant as 'default' | 'success' | 'destructive' | 'warning'];

  return (
    <div className={cn("p-5 rounded-2xl bg-[#141417] border shadow-md flex flex-col justify-between", styles.border)}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{title}</span>
        <div className={cn("p-1.5 rounded-lg", styles.iconBg)}><Icon className={cn("w-3.5 h-3.5", styles.iconColor)} /></div>
      </div>
      <div>
        <h3 className="text-xl font-black text-white">{value}</h3>
        <p className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-wider">{subtitle}</p>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { data: milesBalance } = useMilesBalance();
  const { data: payableInstallments } = usePayableInstallments();
  const { data: receivableInstallments } = useReceivableInstallments();
  const { data: vendasData } = useSales();
  const [filtroConta] = useState("all");

  const stats = useMemo(() => {
    if (!milesBalance) return { miles: 0, invested: 0, market: 0 };
    const filtered = filtroConta === "all" ? milesBalance : milesBalance.filter((m: any) => m.account_id === filtroConta);
    const miles = filtered.reduce((acc: number, m: any) => acc + (m.balance || 0), 0);
    const invested = filtered.reduce((acc: number, m: any) => acc + (m.total_invested || 0), 0);
    const market = filtered.reduce((acc: number, m: any) => acc + ((m.balance || 0) / 1000 * (MARKET_PRICES[m.program_name?.toUpperCase()] || 0)), 0);
    return { miles, invested, market };
  }, [milesBalance, filtroConta]);

  const totalPayable = payableInstallments?.filter((i: any) => i.status === 'pendente').reduce((acc: number, i: any) => acc + Number(i.amount), 0) || 0;
  const totalReceivable = receivableInstallments?.filter((i: any) => i.status === 'pendente').reduce((acc: number, i: any) => acc + Number(i.amount), 0) || 0;
  const equity = (stats.market + totalReceivable) - totalPayable;
  
  const saleStats = useMemo(() => {
    if (!vendasData) return { receita: 0, custo: 0, lucro: 0, cpmV: 0, cpmC: 0, margem: 0, spread: 0 };
    let filtered = filtroConta === "all" ? vendasData : vendasData.filter((v: any) => v.account_id === filtroConta);
    let r = 0, c = 0, q = 0;
    filtered.forEach((v: any) => {
        const tr = Array.isArray(v.receivables) && v.receivables.length > 0 ? Number(v.receivables[0]?.total_amount || 0) : 0;
        r += tr || Number(v.sale_price || 0);
        c += Number(v.total_cost || 0);
        q += Math.abs(Number(v.quantity || 0));
    });
    return { receita: r, custo: c, lucro: r - c, cpmV: q > 0 ? (r / (q / 1000)) : 0, cpmC: q > 0 ? (c / (q / 1000)) : 0, margem: r > 0 ? ((r - c) / r) * 100 : 0, spread: (q > 0 ? (r / (q / 1000)) : 0) - (q > 0 ? (c / (q / 1000)) : 0) };
  }, [vendasData, filtroConta]);

  const salesChartData = useMemo(() => {
    if (!vendasData) return [];
    const grouped: any = {};
    vendasData.forEach((v: any) => {
        const key = v.transaction_date.substring(0, 7);
        if (!grouped[key]) grouped[key] = { key, receita: 0, custo: 0, lucro: 0 };
        const tr = Array.isArray(v.receivables) && v.receivables.length > 0 ? Number(v.receivables[0]?.total_amount || 0) : 0;
        const rec = tr || Number(v.sale_price || 0);
        grouped[key].receita += rec;
        grouped[key].custo += Number(v.total_cost || 0);
        grouped[key].lucro += (rec - Number(v.total_cost || 0));
    });
    return Object.values(grouped).sort((a:any, b:any) => a.key.localeCompare(b.key)).map(i => ({...i, label: format(new Date(`${i.key}-15`), 'MMM/yy', { locale: ptBR })}));
  }, [vendasData]);

  const cashFlowData = useMemo(() => {
    const months: any[] = [];
    const currentDate = new Date();
    for (let i = -2; i <= 6; i++) {
        const date = addMonths(currentDate, i);
        months.push({ label: format(date, 'MMM/yy', { locale: ptBR }), key: format(date, 'yyyy-MM'), entradas: 0, saidas: 0, saldo: 0 });
    }
    payableInstallments?.forEach((i: any) => { const m = months.find(m => m.key === i.due_date.substring(0,7)); if (m) m.saidas += Number(i.amount); });
    receivableInstallments?.forEach((i: any) => { const m = months.find(m => m.key === i.due_date.substring(0,7)); if (m) m.entradas += Number(i.amount); });
    let acc = 0; return months.map(m => { acc += (m.entradas - m.saidas); return {...m, saldo: acc}; });
  }, [payableInstallments, receivableInstallments]);

  const cpmByProgram = useMemo(() => {
    const agrupado: any[] = [];
    milesBalance?.forEach((item: any) => {
      if (!item.program_name) return;
      const existing = agrupado.find(a => a.name === item.program_name);
      if (existing) { existing.balance += item.balance || 0; existing.invested += item.total_invested || 0; } 
      else { agrupado.push({ name: item.program_name, balance: item.balance || 0, invested: item.total_invested || 0 }); }
    });
    return agrupado.map(item => ({ ...item, cpm: item.balance > 0 ? (item.invested / item.balance) * 1000 : 0 }));
  }, [milesBalance]);

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto text-zinc-100">
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <CustomCard title="Patrimônio Líquido" value={formatCurrency(equity)} subtitle="Valor real do negócio" icon={ShieldCheck} variant={equity >= 0 ? 'success' : 'destructive'} />
        <CustomCard title="Valor de Mercado" value={formatCurrency(stats.market)} subtitle="Potencial venda hoje" icon={ArrowUpRight} variant="success" />
        <CustomCard title="Dívida Total" value={formatCurrency(totalPayable)} subtitle="Contas a pagar" icon={CreditCard} variant="warning" />
        <CustomCard title="Índice Cobertura" value={(totalPayable > 0 ? stats.market / totalPayable : 0).toFixed(2)} subtitle="Estoque / Dívida" icon={BarChart3} variant={(totalPayable > 0 ? stats.market / totalPayable : 0) >= 1 ? 'success' : 'destructive'} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CustomCard title="Receita Bruta" value={formatCurrency(saleStats.receita)} subtitle="Total faturado" icon={Banknote} variant="success" />
        <CustomCard title="Lucro Bruto" value={formatCurrency(saleStats.lucro)} subtitle={`Custo: ${formatCurrency(saleStats.custo)}`} icon={TrendingUp} variant={saleStats.lucro >= 0 ? 'success' : 'destructive'} />
        <CustomCard title="CPM Médio Venda" value={formatCPM(saleStats.cpmV)} subtitle={`Spread: ${formatCurrency(saleStats.spread)}`} icon={ArrowUpRight} variant="success" />
        <CustomCard title="Margem de Lucro" value={`${saleStats.margem.toFixed(2)}%`} subtitle={`CPM Custo: ${formatCPM(saleStats.cpmC)}`} icon={Percent} variant={saleStats.margem >= 0 ? 'success' : 'destructive'} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/estoque"><CustomCard title="Milhas em Estoque" value={formatNumber(stats.miles)} subtitle="Total consolidado" icon={Plane} variant="success" /></Link>
        <CustomCard title="CPM Médio Global" value={formatCPM(stats.miles > 0 ? (stats.invested / stats.miles) * 1000 : 0)} subtitle="Custo médio aquisição" icon={TrendingDown} variant="destructive" />
        <CustomCard title="Custo do Estoque" value={formatCurrency(stats.invested)} subtitle="Capital alocado" icon={Wallet} variant="success" />
      </div>
      
      <div className="grid grid-cols-2 gap-6 h-64">
        <Card className="bg-[#141417] border-white/5"><CardContent className="h-full pt-6"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={salesChartData}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="label" stroke="#a1a1aa" fontSize={10}/><Tooltip contentStyle={{backgroundColor:'#18181b'}}/><Bar dataKey="receita" fill="#10b981" /><Bar dataKey="custo" fill="#ef4444" /><Line dataKey="lucro" stroke="#34d399" /></ComposedChart></ResponsiveContainer></CardContent></Card>
        <Card className="bg-[#141417] border-white/5"><CardContent className="h-full pt-6"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={cashFlowData}><CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="label" stroke="#a1a1aa" fontSize={10}/><Tooltip contentStyle={{backgroundColor:'#18181b'}}/><Bar dataKey="entradas" fill="#10b981" /><Bar dataKey="saidas" fill="#ef4444" /><Area dataKey="saldo" fill="#10b981" stroke="#10b981" /></ComposedChart></ResponsiveContainer></CardContent></Card>
      </div>

      <Card className="bg-[#141417] border-white/5">
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="text-zinc-500 uppercase border-b border-white/5"><tr className="text-left"><th className="p-4">Programa</th><th className="p-4">Saldo</th><th className="p-4">CPM Atual</th><th className="p-4">Preço Mercado</th><th className="p-4">Spread Virtual</th></tr></thead>
            <tbody>
              {cpmByProgram.map((item: any) => {
                const mkt = MARKET_PRICES[item.name.toUpperCase()] || 0;
                const sp = mkt - item.cpm;
                return (
                  <tr key={item.name} className="border-b border-white/5 text-white">
                    <td className="p-4 font-bold">{item.name}</td>
                    <td className="p-4">{formatNumber(item.balance)}</td>
                    <td className="p-4 text-red-400">{formatCPM(item.cpm)}</td>
                    <td className="p-4 text-emerald-400">{formatCPM(mkt)}</td>
                    <td className={`p-4 font-bold ${sp >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(sp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}