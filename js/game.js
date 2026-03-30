(function () {
    const LOCAL_ENGINES = ['js/vendor/chess.min.js', './js/vendor/chess.min.js', 'vendor/chess.min.js'];
    const CDN_ENGINE = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';

    function getChessCtor() {
        if (typeof Chess === 'function') return Chess;
        if (typeof window !== 'undefined') {
            if (typeof window.Chess === 'function') return window.Chess;
            if (window.exports && typeof window.exports.Chess === 'function') return window.exports.Chess;
            if (window.module && window.module.exports && typeof window.module.exports.Chess === 'function') {
                return window.module.exports.Chess;
            }
        }
        return null;
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
    }

    async function ensureChessLoaded() {
        if (getChessCtor()) return;

        for (const enginePath of LOCAL_ENGINES) {
            try {
                await loadScript(enginePath);
                if (getChessCtor()) return;
            } catch (_) {
                // Try the next local path.
            }
        }

        await loadScript(CDN_ENGINE);
        if (!getChessCtor()) {
            throw new Error('Chess loaded but constructor was not found on window.');
        }
    }

    function initGame() {
        const queryParams = new URLSearchParams(window.location.search);
        const isPromotionTestMode = queryParams.get('test') === 'promotion';

        const boardEl = document.getElementById('board');
        const statusEl = document.getElementById('status');
        const moveAnnouncer = document.getElementById('moveAnnouncer');
        const gameOverModal = document.getElementById('gameOverModal');
        const promoModal = document.getElementById('promoModal');
        const promoContainer = document.getElementById('promoContainer');
        const gameOverTitle = document.getElementById('gameOverTitle');
        const gameOverDesc = document.getElementById('gameOverDesc');
        const playAgainBtn = document.getElementById('playAgainBtn');

        const fenToName = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

        const ChessCtor = getChessCtor();
        if (!ChessCtor) {
            throw new Error('Chess constructor is unavailable.');
        }
        const game = new ChessCtor();
        const playerColor = 'w';
        const aiColor = 'b';

        let selectedSquare = null;
        let legalTargets = [];
        let attackTargets = [];
        let lastMoveSquares = [];
        let lastPlayerMove = null;
        let aiThinking = false;
        const AI_COPY_TURNS = 4;
        let aiTurnsPlayed = 0;
        const AI_DEPTH_FAST = 2;
        const AI_DEPTH_STRONG = 3;
        const AI_ROOT_MOVE_LIMIT = 20;
        let uiHideTimer = null;

        const swordSound = new Audio('assets/audio/sword.mp3');
        swordSound.preload = 'auto';
        const moveSound = new Audio('assets/audio/move.mp3');
        moveSound.preload = 'auto';

        function playSound(isCapture) {
            const audio = isCapture ? swordSound : moveSound;
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }

        function setStatus(message) {
            statusEl.textContent = message;
        }

        function showOverlayUiTemporarily() {
            document.body.classList.remove('playing-ui-hidden');
            if (uiHideTimer) {
                clearTimeout(uiHideTimer);
            }
            uiHideTimer = setTimeout(() => {
                const modalOpen = !gameOverModal.classList.contains('hidden') || !promoModal.classList.contains('hidden');
                if (!modalOpen) {
                    document.body.classList.add('playing-ui-hidden');
                }
            }, 2300);
        }

        function announceMove(message) {
            if (moveAnnouncer) {
                moveAnnouncer.textContent = message;
            }
        }

        function getSquareButton(square) {
            return boardEl.querySelector(`.square[data-square="${square}"]`);
        }

        function focusSquare(square) {
            const target = getSquareButton(square);
            if (target) target.focus();
        }

        function trapModalFocus(modal) {
            const focusables = Array.from(modal.querySelectorAll('button, [href], select, [tabindex]:not([tabindex="-1"])'));
            if (!focusables.length) return;

            focusables[0].focus();
            const onKeyDown = (event) => {
                if (event.key !== 'Tab') return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };

            modal.addEventListener('keydown', onKeyDown);
            modal.dataset.focusTrapBound = 'true';
        }

        function updateStatus() {
            if (game.game_over()) return;
            if (aiThinking) {
                setStatus('AI is thinking...');
                return;
            }
            const side = game.turn() === playerColor ? 'Your turn.' : 'AI turn.';
            const inCheck = game.in_check() ? ' Check!' : '';
            setStatus(`${side}${inCheck}`);
        }

        function checkGameState() {
            if (game.in_checkmate()) {
                const winner = game.turn() === 'w' ? 'AI' : 'You';
                gameOverTitle.textContent = 'Checkmate';
                gameOverDesc.textContent = `${winner} won the battle.`;
                setTimeout(() => {
                    gameOverModal.classList.remove('hidden');
                    trapModalFocus(gameOverModal);
                    showOverlayUiTemporarily();
                }, 300);
                return true;
            }

            if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
                gameOverTitle.textContent = 'Draw';
                gameOverDesc.textContent = 'The battle ends in a draw.';
                setTimeout(() => {
                    gameOverModal.classList.remove('hidden');
                    trapModalFocus(gameOverModal);
                    showOverlayUiTemporarily();
                }, 300);
                return true;
            }
            return false;
        }

        function buildBoard() {
            const squares = [];
            for (let rank = 8; rank >= 1; rank -= 1) {
                for (let f = 0; f < 8; f += 1) {
                    const square = `${files[f]}${rank}`;
                    const isLight = (rank + f) % 2 === 0;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `square ${isLight ? 'light' : 'dark'}`;
                    btn.dataset.square = square;
                    btn.addEventListener('click', () => onSquareClick(square));
                    btn.addEventListener('keydown', (event) => {
                        const fileIndex = files.indexOf(square[0]);
                        const rank = Number(square[1]);
                        let nextFile = fileIndex;
                        let nextRank = rank;

                        if (event.key === 'ArrowUp') nextRank = Math.min(8, rank + 1);
                        if (event.key === 'ArrowDown') nextRank = Math.max(1, rank - 1);
                        if (event.key === 'ArrowLeft') nextFile = Math.max(0, fileIndex - 1);
                        if (event.key === 'ArrowRight') nextFile = Math.min(7, fileIndex + 1);

                        if (nextFile !== fileIndex || nextRank !== rank) {
                            event.preventDefault();
                            focusSquare(`${files[nextFile]}${nextRank}`);
                        }
                    });
                    squares.push(btn);
                }
            }
            boardEl.replaceChildren(...squares);
        }

        function renderBoard() {
            const inCheck = game.in_check();
            const currentTurn = game.turn();

            boardEl.querySelectorAll('.square').forEach((el) => {
                const square = el.dataset.square;
                const piece = game.get(square);
                let aria = `Square ${square}`;

                el.innerHTML = '';
                if (piece) {
                    const prefix = piece.color === 'w' ? '1' : '2';
                    const pieceName = fenToName[piece.type];
                    const img = document.createElement('img');
                    img.src = `assets/images/board/${prefix}${pieceName}.png`;
                    img.className = 'piece-img';
                    img.alt = `${piece.color === 'w' ? 'white' : 'black'} ${pieceName}`;
                    el.appendChild(img);
                    aria = `${aria}, ${img.alt}`;
                }

                const isSelected = square === selectedSquare;
                const isLegal = legalTargets.includes(square);
                const isAttack = attackTargets.includes(square);
                const isLastMove = lastMoveSquares.includes(square);
                const isCheckKing = inCheck && piece && piece.type === 'k' && piece.color === currentTurn;

                el.classList.toggle('selected', isSelected);
                el.classList.toggle('legal', isLegal);
                el.classList.toggle('attack-legal', isAttack);
                el.classList.toggle('last-move', isLastMove);
                el.classList.toggle('in-check', isCheckKing);

                if (isSelected) aria += ', selected';
                if (isLegal) aria += ', legal move';
                if (isAttack) aria += ', capture move';
                if (isCheckKing) aria += ', in check';
                el.setAttribute('aria-label', aria);
            });

            updateStatus();
        }

        function clearSelection() {
            selectedSquare = null;
            legalTargets = [];
            attackTargets = [];
        }

        function triggerPromotion(source, target) {
            const promotionMap = {
                queen: 'q',
                rook: 'r',
                bishop: 'b',
                knight: 'n'
            };

            promoContainer.innerHTML = '';
            ['queen', 'rook', 'bishop', 'knight'].forEach((piece) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'promo-piece';
                btn.setAttribute('aria-label', `Promote to ${piece}`);
                const img = document.createElement('img');
                img.src = `assets/images/board/1${piece}.png`;
                img.alt = piece;
                btn.appendChild(img);
                btn.addEventListener('click', () => {
                    promoModal.classList.add('hidden');
                    executePlayerMove({ from: source, to: target, promotion: promotionMap[piece] });
                    showOverlayUiTemporarily();
                });
                promoContainer.appendChild(btn);
            });
            promoModal.classList.remove('hidden');
            trapModalFocus(promoModal);
            showOverlayUiTemporarily();
        }

        function onSquareClick(square) {
            if (game.game_over() || aiThinking || game.turn() !== playerColor || !promoModal.classList.contains('hidden')) {
                return;
            }

            showOverlayUiTemporarily();

            const clickedPiece = game.get(square);

            if (!selectedSquare) {
                if (clickedPiece && clickedPiece.color === playerColor) {
                    selectedSquare = square;
                    const rawMoves = game.moves({ square, verbose: true });
                    legalTargets = rawMoves.filter((m) => !m.flags.includes('c') && !m.flags.includes('e')).map((m) => m.to);
                    attackTargets = rawMoves.filter((m) => m.flags.includes('c') || m.flags.includes('e')).map((m) => m.to);
                    renderBoard();
                }
                return;
            }

            const moves = game.moves({ square: selectedSquare, verbose: true });
            const isPromo = moves.some((m) => m.to === square && m.flags.includes('p'));
            if (isPromo) {
                triggerPromotion(selectedSquare, square);
                return;
            }

            executePlayerMove({ from: selectedSquare, to: square });
        }

        function executePlayerMove(moveObj) {
            const moveResult = game.move(moveObj);
            if (!moveResult) {
                const clickedPiece = game.get(moveObj.to);
                if (clickedPiece && clickedPiece.color === playerColor) {
                    selectedSquare = moveObj.to;
                    const rawMoves = game.moves({ square: moveObj.to, verbose: true });
                    legalTargets = rawMoves.filter((m) => !m.flags.includes('c') && !m.flags.includes('e')).map((m) => m.to);
                    attackTargets = rawMoves.filter((m) => m.flags.includes('c') || m.flags.includes('e')).map((m) => m.to);
                } else {
                    clearSelection();
                }
                renderBoard();
                return;
            }

            playSound(moveResult.flags.includes('c') || moveResult.flags.includes('e'));
            lastMoveSquares = [moveResult.from, moveResult.to];
            lastPlayerMove = {
                from: moveResult.from,
                to: moveResult.to,
                promotion: moveResult.promotion
            };
            announceMove(`You played ${moveResult.san}.`);
            clearSelection();
            renderBoard();

            if (!checkGameState()) {
                aiThinking = true;
                updateStatus();
                setTimeout(makeAiMove, 60);
            }
        }

        function evaluateBoard() {
            let total = 0;
            const board = game.board();
            for (let i = 0; i < 8; i += 1) {
                for (let j = 0; j < 8; j += 1) {
                    const piece = board[i][j];
                    if (!piece) continue;
                    const value = pieceValues[piece.type];
                    total += piece.color === aiColor ? value : -value;
                }
            }
            return total;
        }

        function minimax(depth, alpha, beta, isMaximizing) {
            if (depth === 0 || game.game_over()) {
                return evaluateBoard();
            }

            const moves = orderMoves(game.moves({ verbose: true }));
            if (isMaximizing) {
                let best = -999999;
                for (const move of moves) {
                    game.move(move);
                    best = Math.max(best, minimax(depth - 1, alpha, beta, false));
                    game.undo();
                    alpha = Math.max(alpha, best);
                    if (beta <= alpha) break;
                }
                return best;
            }

            let best = 999999;
            for (const move of moves) {
                game.move(move);
                best = Math.min(best, minimax(depth - 1, alpha, beta, true));
                game.undo();
                beta = Math.min(beta, best);
                if (beta <= alpha) break;
            }
            return best;
        }

        function orderMoves(moves) {
            return moves.sort((a, b) => scoreMove(b) - scoreMove(a));
        }

        function scoreMove(move) {
            let score = 0;
            if (move.flags.includes('c') || move.flags.includes('e')) score += 100;
            if (move.flags.includes('p')) score += 90;
            if (move.san && move.san.includes('+')) score += 40;
            if (move.san && move.san.includes('#')) score += 1000;

            const toFile = move.to.charCodeAt(0) - 97;
            const toRank = Number(move.to[1]) - 1;
            const centerDistance = Math.abs(3.5 - toFile) + Math.abs(3.5 - toRank);
            score += Math.max(0, 5 - centerDistance);

            if (move.piece === 'n' || move.piece === 'b') score += 6;
            if (move.piece === 'r' && !(move.flags.includes('c') || move.flags.includes('e'))) score -= 8;

            return score;
        }

        function mirrorSquare(square) {
            const file = square[0];
            const rank = Number(square[1]);
            return `${file}${9 - rank}`;
        }

        function tryCopyPlayerMove() {
            if (!lastPlayerMove) return null;

            const mirroredMove = {
                from: mirrorSquare(lastPlayerMove.from),
                to: mirrorSquare(lastPlayerMove.to)
            };

            if (lastPlayerMove.promotion) {
                mirroredMove.promotion = lastPlayerMove.promotion;
            }

            return game.move(mirroredMove);
        }

        function makeAiMove() {
            if (game.game_over()) {
                aiThinking = false;
                renderBoard();
                return;
            }

            if (aiTurnsPlayed < AI_COPY_TURNS) {
                const copiedMove = tryCopyPlayerMove();
                aiTurnsPlayed += 1;
                lastPlayerMove = null;

                if (copiedMove) {
                    playSound(copiedMove.flags.includes('c') || copiedMove.flags.includes('e'));
                    lastMoveSquares = [copiedMove.from, copiedMove.to];
                    announceMove(`AI copied: ${copiedMove.san}.`);
                    aiThinking = false;
                    renderBoard();
                    checkGameState();
                    return;
                }
            }

            const moves = orderMoves(game.moves({ verbose: true }));
            const aiDepth = moves.length > 18 ? AI_DEPTH_FAST : AI_DEPTH_STRONG;
            const candidateMoves = moves.slice(0, AI_ROOT_MOVE_LIMIT);
            let bestMoves = [];
            let bestScore = -999999;

            for (const move of candidateMoves) {
                game.move(move);
                const score = minimax(Math.max(0, aiDepth - 1), -1000000, 1000000, false);
                game.undo();

                if (score > bestScore) {
                    bestScore = score;
                    bestMoves = [move];
                } else if (score === bestScore) {
                    bestMoves.push(move);
                }
            }

            const chosen = bestMoves.length
                ? bestMoves[Math.floor(Math.random() * bestMoves.length)]
                : moves[0];
            if (chosen.flags.includes('p')) {
                chosen.promotion = 'q';
            }

            const played = game.move(chosen);
            playSound(played.flags.includes('c') || played.flags.includes('e'));
            lastMoveSquares = [played.from, played.to];
            lastPlayerMove = null;
            announceMove(`AI played ${played.san}.`);
            aiThinking = false;
            renderBoard();
            checkGameState();
        }

        function restartGame() {
            game.reset();
            aiThinking = false;
            clearSelection();
            lastMoveSquares = [];
            gameOverModal.classList.add('hidden');
            promoModal.classList.add('hidden');
            aiTurnsPlayed = 0;
            lastPlayerMove = null;
            announceMove('New game started.');
            renderBoard();
            showOverlayUiTemporarily();
        }

        function loadPromotionTestPosition() {
            const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
            const loaded = game.load(fen);
            if (!loaded) return false;

            aiThinking = false;
            clearSelection();
            lastMoveSquares = [];
            gameOverModal.classList.add('hidden');
            promoModal.classList.add('hidden');
            aiTurnsPlayed = 0;
            lastPlayerMove = null;
            setStatus('Promotion test mode: move pawn a7 to a8.');
            announceMove('Promotion test mode loaded. Promote the pawn on a7.');
            renderBoard();
            focusSquare('a7');
            showOverlayUiTemporarily();
            return true;
        }

        playAgainBtn.addEventListener('click', restartGame);

        buildBoard();
        if (!isPromotionTestMode || !loadPromotionTestPosition()) {
            renderBoard();
            focusSquare('e2');
            showOverlayUiTemporarily();
        }

        const uiWakeEvents = ['mousemove', 'pointerdown', 'touchstart', 'keydown'];
        uiWakeEvents.forEach((eventName) => {
            document.addEventListener(eventName, showOverlayUiTemporarily, { passive: true });
        });
    }

    (async function start() {
        try {
            await ensureChessLoaded();
            initGame();
        } catch (error) {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = 'Failed to load chess engine. Refresh and check connection.';
            }
            console.error(error);
        }
    })();
})();
