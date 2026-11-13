# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - heading "Something went wrong" [level=1] [ref=e4]
      - paragraph [ref=e5]:
        - text: Please try again. If the problem continues, contact us.
        - generic [ref=e6]: "Ref: 3102656818"
      - generic [ref=e7]:
        - button "Try again" [ref=e8]
        - link "Home" [ref=e9] [cursor=pointer]:
          - /url: /
  - alert [ref=e10]
```