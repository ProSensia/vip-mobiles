"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCaptcha = createCaptcha;
exports.verifyCaptcha = verifyCaptcha;
const crypto_1 = __importDefault(require("crypto"));
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [id, c] of challenges) {
        if (c.expiresAt < now)
            challenges.delete(id);
    }
}, 5 * 60 * 1000).unref();
function createCaptcha() {
    const a = 1 + Math.floor(Math.random() * 9);
    const b = 1 + Math.floor(Math.random() * 9);
    const id = crypto_1.default.randomBytes(16).toString("hex");
    challenges.set(id, { answer: a + b, expiresAt: Date.now() + CHALLENGE_TTL_MS });
    return { id, question: `${a} + ${b}` };
}
/** One-time use — consumed whether or not the answer is correct, so a wrong guess can't be retried against the same challenge. */
function verifyCaptcha(id, answer) {
    if (!id || answer === undefined)
        return false;
    const challenge = challenges.get(id);
    challenges.delete(id);
    if (!challenge || challenge.expiresAt < Date.now())
        return false;
    return challenge.answer === answer;
}
