/**
 * Carbon Ads placeholder.
 * Replace the inner div with the real Carbon Ads <script> tag once you have your Carbon Ads serve code.
 * See: https://www.carbonads.net/
 */
export default function CarbonAd() { return null; }
function _CarbonAdDisabled({ className = '' }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 border-dashed rounded-xl px-4 py-3 w-full max-w-[330px]">
        {/* Thumbnail placeholder */}
        <div className="w-[130px] h-[100px] bg-slate-700/50 rounded-lg shrink-0 flex items-center justify-center text-slate-600 text-xs text-center leading-tight select-none">
          Ad<br />130×100
        </div>
        {/* Text placeholder */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-2.5 bg-slate-700/60 rounded w-full" />
          <div className="h-2.5 bg-slate-700/60 rounded w-4/5" />
          <div className="h-2.5 bg-slate-700/60 rounded w-3/5" />
          <p className="text-slate-600 text-[10px] mt-2 uppercase tracking-wide">ads via carbon</p>
        </div>
      </div>
    </div>
  );
}