type BrandLogoProps = {
  src: string;
  alt: string;
  className?: string;
};

export function BrandLogo({ src, alt, className = '' }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()}>
      <img src={src} alt={alt} />
      <span className="brand-logo__trademark" aria-hidden="true">™</span>
    </span>
  );
}
