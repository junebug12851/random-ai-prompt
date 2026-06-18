// In-session image results. Images are data/blob URLs held in memory only —
// nothing is stored on a server. Each can be downloaded straight from the browser.
export default function Gallery({ images }) {
  if (!images.length) return null;
  return (
    <div className="gallery">
      {images.map((src, i) => (
        <figure key={i}>
          <img src={src} alt={`result ${i + 1}`} />
          <a className="dl" href={src} download={`random-ai-prompt-${Date.now()}-${i + 1}.png`}>
            Download
          </a>
        </figure>
      ))}
    </div>
  );
}
