const splashScreenLogoCss = `
  .shine-container {
    position: relative;
    display: inline-block;
    overflow: hidden;
  }

  .shine-container::after {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      120deg,
      rgba(0, 27, 68, 0) 0%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(0, 27, 68, 0) 100%
    );
    background-blend-mode: screen;
    mix-blend-mode: color-dodge;
    mask-image: linear-gradient(to right, transparent, white 30%, white 70%, transparent);
    mask-size: 200%;
    transform: skewX(-30deg);
    z-index: 10;
    animation: shine-effect 3s infinite;
  }

  @keyframes shine-effect {
    0% {
      left: -150%;
    }
    50% {
      left: 100%;
    }
    100% {
      left: 150%;
    }
  }
`;

export const SplashScreenLogoStyle = () => {
  return <style>{splashScreenLogoCss}</style>;
};
