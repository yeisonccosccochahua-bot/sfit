import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface RankingEntry {
  position:      number;
  user_id:       string;
  name:          string;
  total_points:  number;
  valid_reports: number;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />;
}

const MEDAL: Record<number, { icon: string; bg: string; text: string }> = {
  1: { icon: '🥇', bg: 'bg-amber-50',  text: 'text-amber-700' },
  2: { icon: '🥈', bg: 'bg-gray-100',  text: 'text-gray-600'  },
  3: { icon: '🥉', bg: 'bg-orange-50', text: 'text-orange-700' },
};

export function CitizenRanking() {
  const { user } = useAuthStore();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get<RankingEntry[]>('/api/incentives/ranking')
      .then((data) => setRanking(data.slice(0, 20)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const myPosition = ranking.find((r) => r.user_id === user?.id);

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ranking municipal</h1>
          <p className="text-xs text-gray-500">Top 20 ciudadanos más activos</p>
        </div>
      </div>

      {/* My position highlight */}
      {myPosition && (
        <div className="bg-[#1B4F72] text-white rounded-2xl p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-lg">#{myPosition.position}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold">Tu posición</p>
            <p className="text-blue-200 text-sm">{myPosition.total_points} pts · {myPosition.valid_reports} reportes válidos</p>
          </div>
          <Medal className="h-6 w-6 text-amber-300" />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 flex gap-3 border border-gray-100">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No se pudo cargar el ranking.</p>
          <p className="text-xs mt-1">Verifica tu conexión e intenta de nuevo.</p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nadie ha participado aún.</p>
          <p className="text-xs mt-1">¡Sé el primero en reportar!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry) => {
            const isMe    = entry.user_id === user?.id;
            const medal   = MEDAL[entry.position];
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 rounded-2xl p-3 border transition-colors ${
                  isMe
                    ? 'bg-[#1B4F72]/5 border-[#1B4F72]/20'
                    : 'bg-white border-gray-100'
                }`}
              >
                {/* Position */}
                <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                  ${medal ? `${medal.bg} ${medal.text}` : 'bg-gray-100 text-gray-500'}`}>
                  {medal ? medal.icon : `#${entry.position}`}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-[#1B4F72]' : 'text-gray-900'}`}>
                    {entry.name} {isMe && <span className="text-xs font-normal text-[#2E86C1]">(tú)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{entry.valid_reports} reportes válidos</p>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-amber-600">{entry.total_points}</p>
                  <p className="text-xs text-gray-400">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
