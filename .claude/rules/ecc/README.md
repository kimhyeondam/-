# ECC 규칙 (선별 적용)

https://github.com/affaan-m/ecc (Everything Claude Code, MIT) 에서 이 프로젝트(Next.js·TypeScript)에 맞는 규칙만 가져왔습니다.
파일은 원본 그대로이고, 갱신할 때는 같은 경로의 파일을 다시 복사하면 됩니다.

- common/security.md · coding-style.md · performance.md · code-review.md
- typescript/security.md · coding-style.md · patterns.md (*.ts, *.tsx 를 다룰 때만 적용)

일부러 뺀 것: 다른 언어 규칙(20개), testing.md(커버리지 80%·TDD 강제는 이 프로젝트 방식과 다름), git-workflow.md(영문 커밋 형식은 쓰지 않음), hooks(도구 실행마다 스크립트를 돌려 느려짐), 에이전트 68개·커맨드 94개(맥락만 커짐).
