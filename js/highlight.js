/**
 * highlight.js — Strudel syntax highlighter
 */
(function () {
  'use strict';

  const KEYWORDS = new Set(
    'const,let,var,function,return,if,else,for,while,do,switch,case,break,' +
    'continue,true,false,null,undefined,new,class,import,export,from,async,' +
    'await,of,in,typeof,instanceof,this,throw,try,catch,finally,default,' +
    'yield,delete,void'.split(',')
  );

  const STRUDEL_GLOBALS = new Set(
    'setcps,setCps,stack,cat,seq,note,s,n,sound,silence,hush,evaluate,' +
    'samples,mini,rev,id,sine,cosine,saw,square,tri,rand,perlin,irand,' +
    'slowcat,fastcat,choose,randcat,degradeBy,wchoose,timeCat,polymeter,' +
    'polyrhythm,pure,reify,register,run'.split(',')
  );

  const METHODS = new Set(
    'slow,fast,rev,jux,early,late,room,delay,lpf,hpf,gain,pan,vowel,' +
    'crush,scale,voicing,transpose,sometimes,every,superimpose,ply,clip,' +
    'add,sub,mul,div,set,struct,mask,euclid,fit,chop,striate,loopAt,' +
    'hurry,speed,cut,orbit,shape,distort,coarse,hcutoff,resonance,djf,' +
    'leslie,squiz,bank,cpm,degradeBy,unDegradeBy,almostNever,almostAlways,' +
    'often,rarely,never,always,off,press,play,dec,end,begin,n,s,note,' +
    'sound,degrade,when,while,range,segment,seg'.split(',')
  );

  function esc(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlight(code) {
    let result = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];

      // $: pattern label (strudel REPL syntax)
      if (ch === '$' && code[i + 1] === ':') {
        result += '<span class="hl-label">$:</span>';
        i += 2;
        continue;
      }

      // Line comments
      if (ch === '/' && code[i + 1] === '/') {
        let j = code.indexOf('\n', i);
        if (j === -1) j = len;
        result += '<span class="hl-comment">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Block comments
      if (ch === '/' && code[i + 1] === '*') {
        let j = code.indexOf('*/', i + 2);
        j = j === -1 ? len : j + 2;
        result += '<span class="hl-comment">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Double-quoted strings
      if (ch === '"') {
        let j = i + 1;
        while (j < len && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
        j = Math.min(j + 1, len);
        result += '<span class="hl-string">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Single-quoted strings
      if (ch === "'") {
        let j = i + 1;
        while (j < len && code[j] !== "'") { if (code[j] === '\\') j++; j++; }
        j = Math.min(j + 1, len);
        result += '<span class="hl-string">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Template literals
      if (ch === '`') {
        let j = i + 1;
        while (j < len && code[j] !== '`') { if (code[j] === '\\') j++; j++; }
        j = Math.min(j + 1, len);
        result += '<span class="hl-string">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Numbers
      if (/\d/.test(ch) && (i === 0 || !/\w/.test(code[i - 1]))) {
        let j = i;
        while (j < len && /[\d.e]/.test(code[j])) j++;
        result += '<span class="hl-number">' + esc(code.slice(i, j)) + '</span>';
        i = j;
        continue;
      }

      // Identifiers
      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i;
        while (j < len && /[\w$]/.test(code[j])) j++;
        const word = code.slice(i, j);

        if (KEYWORDS.has(word)) {
          result += '<span class="hl-keyword">' + word + '</span>';
        } else if (STRUDEL_GLOBALS.has(word)) {
          result += '<span class="hl-fn">' + word + '</span>';
        } else if (i > 0 && code[i - 1] === '.') {
          result += '<span class="hl-method">' + word + '</span>';
        } else if (j < len && code[j] === '(') {
          result += '<span class="hl-fn">' + word + '</span>';
        } else {
          result += esc(word);
        }
        i = j;
        continue;
      }

      // Arrow
      if (ch === '=' && code[i + 1] === '>') {
        result += '<span class="hl-op">=&gt;</span>';
        i += 2;
        continue;
      }

      // Operators
      if ('+-*/%=!<>&|^~?:'.includes(ch)) {
        result += '<span class="hl-op">' + esc(ch) + '</span>';
        i++;
        continue;
      }

      // Brackets
      if ('[]'.includes(ch)) {
        result += '<span class="hl-bracket">' + ch + '</span>';
        i++;
        continue;
      }
      if ('<>'.includes(ch)) {
        result += '<span class="hl-bracket">' + esc(ch) + '</span>';
        i++;
        continue;
      }

      // Default
      result += esc(ch);
      i++;
    }

    return result;
  }

  window.Highlight = { highlight, esc };
})();
