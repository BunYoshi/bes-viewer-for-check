import { log } from "node:console";

interface Position {
  node: Node;
  offset: number;
}

interface NodeMap {
  node: Node;
  globalStart: number;
  globalEnd: number;
  text: string;
}

export class UnderscoreNavigator {
  private rootElement: HTMLElement;
  private underscoreHighlightName = 'navigator-underscore-highlight';
  private boxHighlightName = 'navigator-box-highlight';

  private underscoreRange: { start: number, end: number } | null = null;
  private boxRange: { start: number, end: number } | null = null;

  constructor(rootElement: unknown) {
    let targetNode: any = rootElement;
    if (targetNode && typeof targetNode === 'object' && '$el' in targetNode && targetNode.$el) {
      targetNode = targetNode.$el;
    }
    if (!(targetNode instanceof Node)) {
      throw new Error(`UnderscoreNavigator に渡された値が Node ではありません！`);
    }

    this.rootElement = targetNode as HTMLElement;
    this.initStyles();
    this.initListeners();
    this.refresh();
  }

  public refresh() {
    this.underscoreRange = null;
    this.boxRange = null;
    this.updateHighlights();
  }

  // ★ 追加：外部から呼び出して黄色・水色のハイライトと位置を完全にリセットするパブリックメソッド
  public clearHighlights() {
    this.underscoreRange = null;
    this.boxRange = null;
    
    // CSS Highlights からも消去する
    if (CSS.highlights) {
      CSS.highlights.delete(this.underscoreHighlightName);
      CSS.highlights.delete(this.boxHighlightName);
    }
  }

  private initStyles() {
    if (!CSS.highlights) return;
    if (document.getElementById('dual-navigator-style')) return;
    const style = document.createElement('style');
    style.id = 'dual-navigator-style';
    style.textContent = `
      ::highlight(${this.underscoreHighlightName}) {
        background-color: #ffeb3b; /* 黄色 */
        color: #000;
      }
      ::highlight(${this.boxHighlightName}) {
        background-color: #81d4fa; /* 水色 */
        color: #000;
      }
    `;
    document.head.appendChild(style);
  }

  // 指定されたDOMノードとオフセットから、全体テキスト上のグローバルインデックスを割り出す
  private getGlobalIndexFromNode(targetNode: Node, targetOffset: number, nodeMaps: NodeMap[]): number {
    const map = nodeMaps.find(m => m.node === targetNode);
    if (map) {
      return map.globalStart + targetOffset;
    }
    return -1;
  }

  private initListeners() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.shiftKey && !(e.ctrlKey || e.metaKey)) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveNextPair('_');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.movePrevPair('_');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.expandMarker('_');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.shrinkMarker('_');
        } else if (e.code === 'Quote') {
          e.preventDefault();
          this.moveHalfNextPair('_');
        } else if (e.code === 'BracketLeft') {
          e.preventDefault();
          this.moveHalfPrevPair('_');
        }
      }

      if (!e.shiftKey && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveNextPair('│');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.movePrevPair('│');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.expandMarker('│');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.shrinkMarker('│');
        } else if (e.code === 'Quote') {
          e.preventDefault();
          this.moveHalfNextPair('│');
        } else if (e.code === 'BracketLeft') {
          e.preventDefault();
          this.moveHalfPrevPair('│');
        }
      }
    });

        // ★ 追加：クリック位置を基準にジャンプする機能
    this.rootElement.addEventListener('click', () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);

      const { fullText, nodeMaps } = this.buildTextContext();
      const clickedGlobalIdx = this.getGlobalIndexFromNode(range.startContainer, range.startOffset, nodeMaps);

      if (clickedGlobalIdx === -1) return;

      // クリック位置に最も近い（あるいは内側にある） _ や │ のペアを探してジャンプする
      // 例として、_ のペアを探してジャンプさせる場合：
      const targetPair = this.findNearestPair(fullText, clickedGlobalIdx, '_');
      if (targetPair) {
        this.underscoreRange = targetPair;
        this.updateHighlights();
      }

      // │ についても同様にジャンプさせたい場合：
      const boxPair = this.findNearestPair(fullText, clickedGlobalIdx, '│');
      if (boxPair) {
        this.boxRange = boxPair;
        this.updateHighlights();
      }
    });

  }

  // 指定したグローバルインデックスの「前後」または「内側」にあるペアを探す
  private findNearestPair(fullText: string, targetIdx: number, type: '_' | '│'): { start: number, end: number } | null {
    let regex: RegExp = type === '_' ? /_([^_]+?)_/gs : /│{1,2}([^│]+?)│{1,2}/gs;
    let match: RegExpExecArray | null;
    let nearest: { start: number, end: number } | null = null;
    let minDistance = Infinity;

    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length - 1;

      // クリック位置がこのペアの範囲内にある場合
      if (targetIdx >= start && targetIdx <= end) {
        return { start, end };
      }

      // 範囲外の場合、距離を計算して一番近いものを候補にする
      const distance = Math.min(Math.abs(targetIdx - start), Math.abs(targetIdx - end));
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { start, end };
      }
    }
    return nearest;
  }

  // --- 全体テキストとDOMノードのマップ構築 ---
  private buildTextContext() {
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent && ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let fullText = '';
    const nodeMaps: NodeMap[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const globalStart = fullText.length;
      fullText += text;
      const globalEnd = fullText.length;
      nodeMaps.push({ node, globalStart, globalEnd, text });
    }

    return { fullText, nodeMaps };
  }

  private resolvePosition(globalIndex: number, nodeMaps: NodeMap[]): Position | null {
    for (const map of nodeMaps) {
      if (globalIndex >= map.globalStart && globalIndex <= map.globalEnd) {
        const offset = globalIndex - map.globalStart;
        return { node: map.node, offset };
      }
    }
    if (nodeMaps.length > 0) {
      if (globalIndex < nodeMaps[0].globalStart) {
        return { node: nodeMaps[0].node, offset: 0 };
      }
      const last = nodeMaps[nodeMaps.length - 1];
      return { node: last.node, offset: last.text.length };
    }
    return null;
  }

  private findNextPairInText(fullText: string, startIndex: number, type: '_' | '│'): { start: number, end: number } | null {
    // typeが │ のときは │{1,2} （1文字または2文字連続）を境界として扱う
    let regex: RegExp;
    if (type === '_') {
      regex = /_([^_]+?)_/gs;
    } else {
      regex = /│{1,2}([^│]+?)│{1,2}/gs;
    }

    regex.lastIndex = startIndex;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length - 1;
      if (start >= startIndex) {
        return { start, end };
      }
    }
    return null;
  }

  private findPrevPairInText(fullText: string, startIndex: number, type: '_' | '│'): { start: number, end: number } | null {
    let regex: RegExp;
    if (type === '_') {
      regex = /_([^_]+?)_/gs;
    } else {
      regex = /│{1,2}([^│]+?)│{1,2}/gs;
    }

    let match: RegExpExecArray | null;
    let lastValid: { start: number, end: number } | null = null;

    while ((match = regex.exec(fullText)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length - 1;
      if (start < startIndex) {
        lastValid = { start, end };
      } else {
        break;
      }
    }
    return lastValid;
  }

  // --- 上下キー移動 ---

  private moveNextPair(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    const { fullText } = this.buildTextContext();

    let nextPair: { start: number, end: number } | null = null;

    if (!currentRange) {
      // ★ まだ何も選択されていない状態で初めてキーが押されたら、先頭（0）から最初のペアを探す
      nextPair = this.findNextPairInText(fullText, 0, type);
    } else {
      // 選択されているなら従来通り次のペアを探す
      const searchStartIndex = currentRange.end + 1;
      nextPair = this.findNextPairInText(fullText, searchStartIndex, type);
    }

    if (nextPair) {
      if (type === '_') this.underscoreRange = nextPair;
      else this.boxRange = nextPair;
      this.updateHighlights();
      this.scrollToCurrent(type, 'start');
    }
  }

  private movePrevPair(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    const { fullText } = this.buildTextContext();

    if (!currentRange) return;
    const prevPair = this.findPrevPairInText(fullText, currentRange.start, type);

    if (prevPair) {
      if (type === '_') this.underscoreRange = prevPair;
      else this.boxRange = prevPair;
      this.updateHighlights();
      this.scrollToCurrent(type, 'start');
    }
  }
  
  // --- 上下半ステップ移動 ---
  private moveHalfNextPair(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    if (!currentRange) return;

    const { fullText } = this.buildTextContext();

    if (type === '_') {
      let markerStart, markerEnd
      for (let i = currentRange.start + 1; i <= currentRange.end; i++) {
        if (fullText[i] === '_') {
          markerStart = i
          break;
        }
      }
      for (let i = currentRange.end + 1; i < fullText.length; i++) {
        if (fullText[i] === '_') {
          markerEnd = i
          break;
        }
      }
      if(markerStart && markerEnd) {
        const newRange = { start: markerStart, end: markerEnd };
        this.underscoreRange = newRange;
        this.updateHighlights();
        this.scrollToCurrent(type, 'start');
      }
    } else {
      let markerStart, markerEnd
      for (let i = currentRange.start + 1; i <= currentRange.end; i++) {
        if (fullText[i] === '│' && i !== currentRange.start + 1) {
          markerStart = i
          break;
        }
      }
      for (let i = currentRange.end + 1; i < fullText.length; i++) {
        if (fullText[i] === '│') {
          if (fullText[i + 1] !== '│') {
            markerEnd = i
          } else {
            markerEnd = i + 1
          }
          break;
        }
      }
      if (markerStart && markerEnd) {
        const newRange = { start: markerStart, end: markerEnd };
        this.boxRange = newRange;
        this.updateHighlights();
        this.scrollToCurrent(type, 'start');
      }
    }
  }

  private moveHalfPrevPair(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    if (!currentRange) return;

    const { fullText } = this.buildTextContext();

    if (type === '_') {
      let markerStart, markerEnd
      for (let i = currentRange.start - 1; i >= 0; i--) {
        if (fullText[i] === '_') {
          markerStart = i
          break;
        }
      }
      for (let i = currentRange.end - 1; i >= currentRange.start; i--) {
        if (fullText[i] === '_') {
          markerEnd = i
          break;
        }
      }
      if(markerStart && markerEnd) {
        const newRange = { start: markerStart, end: markerEnd };
        this.underscoreRange = newRange;
        this.updateHighlights();
        this.scrollToCurrent(type, 'start');
      }
    } else {
      let markerStart, markerEnd
      for (let i = currentRange.start - 1; i >= 0; i--) {
        if (fullText[i] === '│') {
          if (fullText[i - 1] !== '│') {
            markerStart = i
          } else {
            markerStart = i - 1
          }
          break;
        }
      }
      for (let i = currentRange.end - 1; i >= currentRange.start; i--) {
        if (fullText[i] === '│' && i !== currentRange.end - 1) {
          markerEnd = i
          break;
        }
      }
      if (markerStart && markerEnd) {
        const newRange = { start: markerStart, end: markerEnd };
        this.boxRange = newRange;
        this.updateHighlights();
        this.scrollToCurrent(type, 'start');
      }
    }
  }

  // --- 左右キー伸縮（│の場合は連続する │塊 を1つのマーカーとして扱う） ---

  private expandMarker(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    if (!currentRange) return;

    const { fullText } = this.buildTextContext();

    if (type === '_') {
      for (let i = currentRange.end + 1; i < fullText.length; i++) {
        if (fullText[i] === '_') {
          const newRange = { start: currentRange.start, end: i };
          this.underscoreRange = newRange;
          this.updateHighlights();
          this.scrollToCurrent(type, 'end');
          break;
        }
      }
    } else {
      let markerEnd
      for (let i = currentRange.end + 1; i < fullText.length; i++) {
        if (fullText[i] === '│') {
          if (fullText[i + 1] !== '│') {
            markerEnd = i
          } else {
            markerEnd = i + 1
          }
          break;
        }
      }
      if (markerEnd) {
        const newRange = { start: currentRange.start, end: markerEnd };
        this.boxRange = newRange;
        this.updateHighlights();
        this.scrollToCurrent(type, 'end');
      }
    }
  }

  private shrinkMarker(type: '_' | '│') {
    const currentRange = type === '_' ? this.underscoreRange : this.boxRange;
    if (!currentRange) return;

    const { fullText } = this.buildTextContext();

    if (type === '_') {
      let lastFoundIdx = -1;
      for (let i = currentRange.start + 1; i < currentRange.end; i++) {
        if (fullText[i] === '_') {
          lastFoundIdx = i;
        }
      }
      if (lastFoundIdx !== -1) {
        this.underscoreRange = { start: currentRange.start, end: lastFoundIdx };
        this.updateHighlights();
        this.scrollToCurrent(type, 'end');
      }
    } else {
      let markerEnd
      for (let i = currentRange.end - 1; i > currentRange.start; i--) {
        if (fullText[i] === '│' && i !== currentRange.end - 1) {
          markerEnd = i
          break;
        }
      }
      let hasContent = false
      if (markerEnd) {
        for (let i = currentRange.start; i <= markerEnd ; i++) {
          if (fullText[i] !== '│') {
            hasContent = true
            break
          }
        }
        if (hasContent) {
          const newRange = { start: currentRange.start, end: markerEnd };
          this.boxRange = newRange;
          this.updateHighlights();
          this.scrollToCurrent(type, 'end');
        }
      }
    }
  }

  // --- ハイライト＆スクロールの反映 ---

  private updateHighlights() {
    if (!CSS.highlights) return;
    const { nodeMaps } = this.buildTextContext();

    if (this.underscoreRange) {
      const startPos = this.resolvePosition(this.underscoreRange.start, nodeMaps);
      // ハイライト対象の終了位置は、マッチした部分全体の長さをカバーするため end + 1 まで含める
      const endPos = this.resolvePosition(this.underscoreRange.end + 1, nodeMaps);

      if (startPos && endPos) {
        const range = new Range();
        try {
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);
          CSS.highlights.set(this.underscoreHighlightName, new Highlight(range));
        } catch (e) {
          console.error('Underscore range error:', e);
        }
      }
    }

    if (this.boxRange) {
      const startPos = this.resolvePosition(this.boxRange.start, nodeMaps);
      const endPos = this.resolvePosition(this.boxRange.end + 1, nodeMaps);

      if (startPos && endPos) {
        const range = new Range();
        try {
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);
          CSS.highlights.set(this.boxHighlightName, new Highlight(range));
        } catch (e) {
          console.error('Box range error:', e);
        }
      }
    }
  }

  private scrollToCurrent(type: '_' | '│', point: string) {
    const range = type === '_' ? this.underscoreRange : this.boxRange;
    if (!range) return;

    const { nodeMaps } = this.buildTextContext();
    let startPos
    if (point === 'start') {
      startPos = this.resolvePosition(range.start, nodeMaps);
    } else {
      startPos = this.resolvePosition(range.end, nodeMaps);
    }

    if (startPos && startPos.node.parentElement) {
      startPos.node.parentElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }
}