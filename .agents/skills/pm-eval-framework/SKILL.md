---
name: pm-eval-framework
description: >-
  Use this skill when the user asks to evaluate an AI feature, run the "eval-evaluator", 
  or audit the AI evaluation framework. It runs a 10-point PM questionnaire against the codebase.
---

# PM Eval Framework (The 10-Point Audit)

This skill instructs the agent to audit a specific AI feature or the entire repository's evaluation scripts (`eval/index.js`) against the 10-point Product Management Eval Framework.

## Instructions for the Agent

When the user triggers this skill, you must analyze the codebase and generate a report answering the following 10 questions based on the *current state* of the repository's AI pipelines. 

For each question, state the **Current Status** and then identify any **Gaps / Action Items**.

1. **What does a correct answer look like for your feature?**
   *(Agent Tip: Check Zod schemas, prompt files, and structural constraints).*
2. **Where did your golden set come from?**
   *(Agent Tip: Look for test data folders or mock responses).*
3. **How big is it, and why that size?**
   *(Agent Tip: Count the number of test cases).*
4. **What does your grader actually measure?**
   *(Agent Tip: Look for LLM-as-a-judge prompts vs. pure JSON schema validators).*
5. **What is your baseline?**
   *(Agent Tip: Check for baseline score thresholds in the CI/CD or eval scripts).*
6. **What counts as a regression?**
   *(Agent Tip: Determine what fails the CI/CD pipeline).*
7. **What broke when you first ran it?**
   *(Agent Tip: Check git commit history or PR descriptions for early bug fixes).*
8. **How often does it run, and what happens when it fails?**
   *(Agent Tip: Check `.github/workflows/` to see if evals run on PRs).*
9. **What did you change because of the result?**
   *(Agent Tip: Check for changes to the AI model selection or system prompt).*
10. **What can your eval still not catch?**
    *(Agent Tip: Identify blind spots, such as hallucinations or bias).*

## Deliverable

Output the result as a beautifully formatted Markdown artifact. If you find critical gaps (e.g., the golden dataset is too small, or the eval doesn't catch hallucinations), proactively suggest writing code to fix them!
