- I'm using pnpm on bash, so use / instead of \ in your terminal commands

- Your terminal commands should always follow this format: cd full/path/to/destination && your-command-here

- We are using Convex. We hav complete "Guidelines and best practices for building Convex projects, including database schema design, queries, mutations, and real-world examples" available in the file `convex_rules.mdc`. Feel free to look it up anytime you are unsure of what to do or how to do something in Convex. It can also come in handy when fixing convex backend errors

- Unless stated otherwise, It's preferable and highly desirable you making all of your changes to a file at a time/at a go than going back and forth on the same file

- Always ADHERE STRICTLY to our existing design system, theme, color, layouts and standards, UNLESS stated otherwise!

- Always ADHERE STRICTLY to existing implementation patterns and standards for consistency sake!

- Always format and structure your response properly using Markdown so it's easily readable

- Anytime you lay out phase-by-phase implementation plans, ensure that you STRICTLY ADHERE to the plan and work in an organized manner! Approach each phase in order and never deviate from the plan UNLESS EXPLICITLY I state so.

- UNLESS EXPLICITLY STATED, you don't have to ask before proceeding with another phase after completing one. Just share your updates and keep going.

- Use the colors from this sample mermaid diagram whenever you have to create one:
  flowchart TD
  %% Nodes
  A("fab:fa-youtube Starter Guide")
  B("fab:fa-youtube Make Flowchart")
  n1@{ icon: "fa:gem", pos: "b", h: 24}
  C("fa:fa-book-open Learn More")
  D{"Use the editor"}
  n2(Many shapes)@{ shape: delay}
  E(fa:fa-shapes Visual Editor)
  F("fa:fa-chevron-up Add node in toolbar")
  G("fa:fa-comment-dots AI chat")
  H("fa:fa-arrow-left Open AI in side menu")
  I("fa:fa-code Text")
  J(fa:fa-arrow-left Type Mermaid syntax)

        %% Edge connections between nodes
            A --> B --> C --> n1 & D & n2
            D -- Build and Design --> E --> F
            D -- Use AI --> G --> H
            D -- Mermaid js --> I --> J

        %% Individual node styling. Try the visual editor toolbar for easier styling!
            style E color:#FFFFFF, fill:#AA00FF, stroke:#AA00FF
            style G color:#FFFFFF, stroke:#00C853, fill:#00C853
            style I color:#FFFFFF, stroke:#2962FF, fill:#2962FF

        %% You can add notes with two "%" signs in a row!
