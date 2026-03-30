const assert = require('assert');
const ChessModule = require('../js/vendor/chess.min.js');
const Chess = ChessModule.Chess || ChessModule.default || ChessModule;

function runTests() {
    const game = new Chess();

    // Initial legal move count from standard chess opening position.
    assert.strictEqual(game.moves().length, 20, 'Initial position should have 20 legal moves');

    game.move('e4');
    game.move('e5');
    game.move('Qh5');
    game.move('Nc6');
    game.move('Bc4');
    game.move('Nf6');
    game.move('Qxf7#');

    assert.strictEqual(game.in_checkmate(), true, 'Expected checkmate after Scholar\'s Mate sequence');

    game.undo();
    assert.strictEqual(game.in_checkmate(), false, 'Undo should revert checkmate state');

    console.log('All chess smoke tests passed.');
}

runTests();
