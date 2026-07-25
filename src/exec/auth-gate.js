// AI는 실행할 수 없다. "조심한다"가 아니라 호출할 함수 자체가 없다.
// prepare()는 계획만 만들고, execute()는 사람이 인증해 받은 토큰이 있어야만 돈다.

let counter = 0;

export function createAuthGate() {
  const issued = new Map(); // planId -> token

  return {
    issue(planId) {
      const token = `tok_${planId}_${++counter}`;
      issued.set(planId, token);
      return token;
    },
    isValid(token, planId) {
      return Boolean(token) && issued.get(planId) === token;
    },
    consume(token, planId) {
      if (!this.isValid(token, planId)) return false;
      issued.delete(planId); // 1회용
      return true;
    },
  };
}

export function createExecutor({ authGate, tools }) {
  const plans = new Map();

  async function prepare(name, args) {
    const tool = tools[name];
    if (!tool) throw new Error(`알 수 없는 도구: ${name}`);
    const planId = `plan_${++counter}`;
    const plan = { planId, tool: name, args, requiresAuth: Boolean(tool.requiresAuth) };
    plans.set(planId, plan);
    return plan; // 실행하지 않는다
  }

  async function execute(planId, token) {
    const plan = plans.get(planId);
    if (!plan) throw new Error(`알 수 없는 계획: ${planId}`);
    const tool = tools[plan.tool];

    // 이미 실행된 계획은 다시 실행하지 않는다.
    // 토큰 소비만으로는 부족하다 — issue()를 다시 부르면 새 토큰이 나오므로,
    // 화면에서 인증 버튼을 두 번 누르면 이중 실행이 된다.
    if (plan.executed) {
      throw new Error("이미 실행된 요청입니다");
    }

    if (plan.requiresAuth && !authGate.consume(token, planId)) {
      throw new Error("본인 인증이 필요합니다 (AuthGate 미통과)");
    }

    // 계획 객체는 남겨 둔다. 지우면 재실행 시도의 오류 메시지가
    // "알 수 없는 계획"이 되어 무슨 일이 일어났는지 알 수 없다.
    plan.executed = true;
    return await tool.run(plan.args);
  }

  return { prepare, execute };
}
