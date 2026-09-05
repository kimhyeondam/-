# PPT 생성 스크립트

`build.js`는 `draft/사업계획서-초안-v3.pptx`를 만드는 pptxgenjs 스크립트입니다.
내용을 고친 뒤 다시 만들려면:

```bash
npm install pptxgenjs          # 처음 한 번
node business-plan/deck/build.js "business-plan/draft/사업계획서-초안-v3.pptx"
```

- 글꼴은 맑은 고딕(Malgun Gothic). 한국어 Windows PowerPoint에서 그대로 열립니다.
- `[확인]` 표시는 대표가 채울 칸, 슬라이드 노트에 확인 사항이 정리되어 있습니다.
