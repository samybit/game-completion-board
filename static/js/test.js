describe('Game Progress Calculation Logic', function () {

    it('should return 0 if a game has no achievements', function () {
        const achievements = [];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(0);
    });

    it('should return 50 when exactly half of the achievements are completed', function () {
        const achievements = [
            { id: 1, name: "Defeat Fajar", completed: true },
            { id: 2, name: "Defeat Sean", completed: false }
        ];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(50);
    });

    it('should return 100 when all achievements are completed', function () {
        const achievements = [
            { id: 1, name: "I am Batman", completed: true },
            { id: 2, name: "Knightfall", completed: true }
        ];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(100);
    });

    it('should round correctly for uneven fractions (e.g., 1 out of 3 is 33%)', function () {
        const achievements = [
            { completed: true },
            { completed: false },
            { completed: false }
        ];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(33); // 1/3 is 33.333..., should round to 33
    });
});