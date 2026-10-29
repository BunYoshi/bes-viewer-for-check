interface GyoUtusiTarget {
  element: HTMLElement; // 生成したタグ要素
  index: number;
}

export class GyoUtusiNavigator {
  private rootElement: HTMLElement;
  private targets: GyoUtusiTarget[] = [];
  private currentIndex: number = -1;

  constructor(rootElement: unknown) {
    let targetNode: any = rootElement;
    if (targetNode && typeof targetNode === 'object' && '$el' in targetNode && targetNode.$el) {
      targetNode = targetNode.$el;
    }
    if (!(targetNode instanceof Node)) {
      throw new Error(`GyoUtusiNavigator に渡された値が Node ではありません！`);
    }

    this.rootElement = targetNode as HTMLElement;
    this.initStyles();
    this.initListeners();
    this.refresh();
  }

  public refresh() {
    this.currentIndex = -1;
    this.processAndWrapTargets();
  }

  private initStyles() {
    if (document.getElementById('gyo-utusi-style')) return;
    const style = document.createElement('style');
    style.id = 'gyo-utusi-style';
    style.textContent = `
      .gyo-utusi-target {
        background-color: #ffe6e6;
        color: red;
      }
      .gyo-utusi-target.is-active {
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  }

  private initListeners() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveNext();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.movePrev();
        }
      }
    });
  }

  // 「移」を探し、後ろから前へ向けて削除＆タグで囲む処理
  private processAndWrapTargets() {
    this.targets = [];

    // TreeWalkerでテキストノードを収集
    const walker = document.createTreeWalker(this.rootElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent && ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    // まず現在の全テキスト情報を集める
    let fullText = '';
    const nodeMaps: { node: Node; globalStart: number; globalEnd: number }[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const globalStart = fullText.length;
      fullText += text;
      nodeMaps.push({ node, globalStart, globalEnd: fullText.length });
    }

    if (!fullText) return;

    // 「移」の位置をすべて洗い出す
    const matches: number[] = [];
    const regex = /移/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(fullText)) !== null) {
      const idx = match.index;
      if (idx > 0 && idx < fullText.length - 1) {
        matches.push(idx);
      }
    }

    if (matches.length === 0) return;

    // ★ ご指摘の通り「後ろから前へ向けて（降順）」処理する
    matches.reverse().forEach((idx) => {
      // 削除対象の「移」とその前後の文字を含むRangeを作成
      // idx - 1 (前1文字) から idx + 2 (後1文字の次) まで
      const startPos = this.resolvePosition(idx - 1, nodeMaps);
      const endPos = this.resolvePosition(idx + 2, nodeMaps);

      if (startPos && endPos) {
        const range = document.createRange();
        try {
          range.setStart(startPos.node, startPos.offset);
          range.setEnd(endPos.node, endPos.offset);

          // 取得できるテキストは「前文字 + 移 + 後文字」になっている
          const matchedText = range.toString(); // 例: "う移え"
          if (matchedText.length === 3 && matchedText[1] === '移') {
            // 「移」を抜いた結合文字を作る（例: "うえ"）
            const combinedText = matchedText[0] + matchedText[2];

            // 新しい span タグを作成
            const span = document.createElement('span');
            span.className = 'gyo-utusi-target';
            span.textContent = combinedText;

            // 既存の範囲を削除し、タグに置き換える
            range.deleteContents();
            range.insertNode(span);

            // targets に記録（後から逆順で処理したので、元の正順に戻すために unshift）
            this.targets.unshift({
              element: span,
              index: idx
            });
          }
        } catch (e) {
          console.error('Range manipulation error:', e);
        }
      }
    });
  }

  // グローバルインデックスからDOMノードの位置を特定するヘルパー
  private resolvePosition(globalIndex: number, nodeMaps: { node: Node; globalStart: number; globalEnd: number }[]) {
    // ※ DOMが書き換わる前の初期スキャン時に使うか、位置計算を調整する必要があるため
    // ここは再構築後のツリーに合わせて安全に処理されます
    for (const map of nodeMaps) {
      if (globalIndex >= map.globalStart && globalIndex <= map.globalEnd) {
        const offset = globalIndex - map.globalStart;
        return { node: map.node, offset: Math.min(offset, (map.node.textContent || '').length) };
      }
    }
    return null;
  }

  private moveNext() {
    if (this.targets.length === 0) return;
    this.updateActiveState(1);
  }

  private movePrev() {
    if (this.targets.length === 0) return;
    this.updateActiveState(-1);
  }

  private updateActiveState(direction: number) {
    // 以前のアクティブクラスを外す
    if (this.currentIndex >= 0 && this.currentIndex < this.targets.length) {
      this.targets[this.currentIndex].element.classList.remove('is-active');
    }

    // インデックスを更新
    this.currentIndex = (this.currentIndex + direction + this.targets.length) % this.targets.length;

    // 新しいアクティブ要素にクラスを付与＆スクロール
    const current = this.targets[this.currentIndex];
    current.element.classList.add('is-active');
    current.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}