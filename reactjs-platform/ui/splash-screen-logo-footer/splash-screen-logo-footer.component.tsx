'use client';

import type { SplashScreenLogoProps } from './splash-screen-logo-footer.type';
import React from 'react';
import { SplashScreenLogoStyle } from './splash-screen-logo-footer.style';

export const SplashScreenLogo: React.FC<SplashScreenLogoProps> = (props) => {
  const { className = 'bg-[#0A2948]', logoImage = '', logoSmall = '' } = props;

  return (
    <div
      className={`${className} fixed inset-0 z-50 flex h-screen flex-col items-center justify-center overflow-hidden`}>
      <div className="hidden text-center lg:block">
        <div className="shine-container relative inline-block overflow-hidden">
          <img
            className="mx-auto mb-8"
            src={logoImage}
            alt="Logo and Text"
            width={626}
            height={204}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="mt-20 flex w-full flex-col items-center">
          <div className="mx-auto my-4 w-[300px] border-t border-[#8C6B4F]" />
          <img
            className="mt-2 inline-block"
            src={logoSmall}
            alt="Bottom Logo"
            width={30}
            // height={40}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      {/* <div className="block text-center lg:hidden">
        <div className="shine-container relative inline-block overflow-hidden">
          <img
            className="mx-auto mb-8 h-auto w-full max-w-[90%] sm:max-w-[70%]"
            src={logoImage}
            alt="Logo and Text"
            width={626}
            height={204}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="mt-10 flex w-full flex-col items-center">
          <div className="mx-auto my-4 w-[150px] border-t border-[#8C6B4F] sm:w-[200px]" />
          <img
            className="mt-2 inline-block size-auto max-w-[50%] sm:max-w-[40%]"
            src={logoSmall}
            alt="Bottom Logo"
            width={30}
            // height={40}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div> */}
      <SplashScreenLogoStyle />
    </div>
  );
};
