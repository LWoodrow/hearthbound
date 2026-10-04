export function ModelLoadProgress({loading,progress}:{loading:boolean;progress:number|null}) {
  const known=!loading && progress !== null;
  const percentage=known ? Math.max(0,Math.min(100,progress)) : null;
  return <span className={`model-load-track ${loading ? "loading" : ""}`} role="progressbar" aria-label={loading ? "Model loading — progress not yet available" : "Model load progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined}><i style={{width:`${percentage ?? 35}%`}}/></span>;
}
