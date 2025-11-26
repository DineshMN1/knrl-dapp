// // src/components/MyEvents.tsx
// import { useEffect, useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { formatAddress } from '@/utils';
// import { JsonRpcProvider, Interface } from 'ethers';
// import TicketingABI from '../contracts/TicketingTarget.json';
// import { RPC_URL, TICKETING_CONTRACT_ADDRESS } from '@/const';

// interface EventItem {
//   eventId: string;
//   name?: string;
//   txHash: string;
//   blockNumber?: number;
//   timestamp?: number;
// }

// const formatDate = (d: Date) => {
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, '0');
//   const day = String(d.getDate()).padStart(2, '0');
//   const hh = String(d.getHours()).padStart(2, '0');
//   const mm = String(d.getMinutes()).padStart(2, '0');
//   return `${y}-${m}-${day} ${hh}:${mm}`;
// };

// export const MyEvents = () => {
//   const [events, setEvents] = useState<EventItem[]>([]);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     let mounted = true;
//     const provider = new JsonRpcProvider(RPC_URL);
//     const iface = new Interface(TicketingABI as any);

//     const run = async () => {
//       try {
//         setLoading(true);
//         // find an event in ABI that looks like an event-creation event (e.g., EventCreated)
//         const eventsInAbi = iface.fragments.filter((f: any) => f.type === 'event');
//         const eventFragment = eventsInAbi.find((f: any) => {
//           const n = String(f?.name || '').toLowerCase();
//           return n.includes('event') && (n.includes('create') || n.includes('created'));
//         }) as any | undefined;

//         const eventName = eventFragment?.name ?? 'EventCreated';
//         const eventTopic = iface.getEventTopic(eventName);

//         const filter = {
//           address: TICKETING_CONTRACT_ADDRESS,
//           topics: [eventTopic],
//           fromBlock: 0,
//           toBlock: 'latest'
//         };

//         const logs = await provider.getLogs(filter);
//         const out: EventItem[] = [];

//         // iterate newest-first
//         for (const log of logs.reverse()) {
//           try {
//             const parsed = iface.parseLog(log);
//             const evtId = parsed.args?.eventId ?? parsed.args?.id ?? parsed.args?.[0];
//             const name = parsed.args?.name ?? parsed.args?.title ?? undefined;
//             const block = log.blockNumber;
//             let ts: number | undefined;
//             try {
//               const blockData = await provider.getBlock(block);
//               ts = blockData ? blockData.timestamp : undefined;
//             } catch (err) {
//               // ignore block fetch errors
//             }

//             out.push({
//               eventId: evtId ? String(evtId.toString()) : '—',
//               name: name ? String(name) : undefined,
//               txHash: log.transactionHash,
//               blockNumber: block,
//               timestamp: ts
//             });
//           } catch (err) {
//             // ignore parse errors for unrelated logs
//             continue;
//           }
//         }

//         if (mounted) setEvents(out);
//       } catch (err) {
//         console.error('Failed to fetch events', err);
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     };

//     run();

//     return () => { mounted = false; };
//   }, []);

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>My Events</CardTitle>
//       </CardHeader>
//       <CardContent>
//         {loading ? (
//           <div className="text-sm text-muted-foreground">Loading events...</div>
//         ) : events.length === 0 ? (
//           <div className="text-sm text-muted-foreground">No events found.</div>
//         ) : (
//           <div className="space-y-3">
//             {events.map((e) => (
//               <div key={e.txHash} className="p-3 border rounded-md">
//                 <div className="flex justify-between items-center">
//                   <div>
//                     <div className="text-sm font-medium">{e.name ?? 'Unnamed event'}</div>
//                     <div className="text-xs text-muted-foreground">
//                       Event ID: <span className="font-mono">{e.eventId}</span>
//                     </div>
//                   </div>
//                   <div className="text-right text-xs">
//                     <div className="text-muted-foreground">{e.blockNumber ? `block ${e.blockNumber}` : ''}</div>
//                     <a href={`https://sepolia.etherscan.io/tx/${e.txHash}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-mono">
//                       {formatAddress(e.txHash)}
//                     </a>
//                   </div>
//                 </div>
//                 {e.timestamp && (
//                   <div className="text-xs text-muted-foreground mt-2">
//                     {formatDate(new Date(e.timestamp * 1000))}
//                   </div>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// };

// export default MyEvents;
