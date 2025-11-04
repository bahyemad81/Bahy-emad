
import React, { useRef, useEffect } from 'react';
import type { ViewElement } from '../types';

interface TextViewerProps {
  viewElements: ViewElement[];
  activeWordIndex: number;
}

const TextViewer: React.FC<TextViewerProps> = ({ viewElements, activeWordIndex }) => {
  const activeWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, [activeWordIndex]);

  return (
    <div
      className="bg-gray-50/70 p-6 rounded-lg border border-gray-200 text-3xl md:text-4xl font-medium"
      style={{ lineHeight: '2', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}
    >
      {viewElements.map((element, index) => {
        if (element.type === 'word') {
          return (
            <span
              key={index}
              ref={element.originalIndex === activeWordIndex ? activeWordRef : null}
              className={`transition-all duration-200 ease-in-out ${
                element.originalIndex === activeWordIndex
                  ? 'text-black bg-yellow-300 rounded-md px-1'
                  : 'text-gray-800'
              }`}
            >
              {element.word}
            </span>
          );
        } else { // type === 'whitespace'
          return <React.Fragment key={index}>{element.content}</React.Fragment>;
        }
      })}
    </div>
  );
};

export default TextViewer;
