describe('Game Progress Calculation', function () {
    it('should return 0 if there are no achievements', function () {
        const achievements = [];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(0);
    });

    it('should return 50 when exactly half of the achievements are completed', function () {
        const achievements = [
            { completed: true },
            { completed: false }
        ];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(50);
    });

    it('should return 100 when all achievements are completed', function () {
        const achievements = [
            { completed: true },
            { completed: true }
        ];
        const result = window.calculateProgress(achievements);
        expect(result).to.equal(100);
    });
});