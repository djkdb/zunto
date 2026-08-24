"use client";

/** 서버 시각과 로컬 시각의 차이를 추정해서 모두가 같은 타이머를 본다 */
export class ServerClock {
  private offset = 0;
  private samples: number[] = [];

  /** 응답을 받을 때마다 호출. serverNow 는 서버가 응답을 만든 시각 */
  sync(serverNow: number, requestSentAt?: number) {
    const localNow = Date.now();
    const latencyHalf = requestSentAt ? (localNow - requestSentAt) / 2 : 0;
    const sample = serverNow + latencyHalf - localNow;
    this.samples.push(sample);
    if (this.samples.length > 9) this.samples.shift();
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];   // 중앙값 = 튀는 값에 강함
  }

  now() { return Date.now() + this.offset; }
  get skew() { return this.offset; }

  /** 남은 시간(ms). 종료 시각이 없으면 null */
  remaining(endsAt: number | null) {
    if (endsAt === null) return null;
    return endsAt - this.now();
  }
}

export const serverClock = new ServerClock();
