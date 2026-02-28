import type { FeatureCard as FeatureCardType } from '../types/dashboard';

type Props = {
  feature: FeatureCardType;
};

const FeatureCard = ({ feature }: Props) => {
  const statusClass =
    feature.status === 'Ready'
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-400/40 bg-amber-500/10 text-amber-200';

  return (
    <article className="rounded-2xl border border-borderSoft bg-card/70 p-5 transition hover:border-cyan-400/40 hover:-translate-y-0.5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass}`}>
          {feature.status}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">{feature.description}</p>
    </article>
  );
};

export default FeatureCard;
