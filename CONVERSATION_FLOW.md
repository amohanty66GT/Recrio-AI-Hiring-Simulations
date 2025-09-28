# Recrio ABABAB Conversation Flow

## Overview

The Recrio simulation now implements an ABABAB conversation pattern that creates a more natural and engaging interview experience. This pattern ensures that the AI and applicant take turns speaking, with the AI providing contextual follow-up questions and transitioning to new problems after a few exchanges.

## Flow Pattern

### A - AI Starts
- AI begins with a role-specific prompt and initial question
- Based on the scenario template (swe, de, ml)

### B - Applicant Responds
- Applicant provides their answer/approach
- System analyzes the response for context

### A - AI Follow-up
- AI asks a contextual follow-up question (1st follow-up)
- Questions are tailored to the role and response content

### B - Applicant Responds
- Applicant answers the follow-up

### A - AI Follow-up
- AI asks another contextual follow-up question (2nd follow-up)

### B - Applicant Responds
- Applicant answers the second follow-up

### A - AI New Problem
- After 2 follow-ups, AI transitions to a completely new problem
- Resets the conversation state for the new problem
- Pattern repeats: A-B-A-B-A-B...

## Implementation Details

### Role-Specific Questions

Each role (SWE, Data Engineer, ML Engineer) has tailored follow-up questions:

**Software Engineer:**
- Technical trade-offs
- Monitoring and metrics
- Production emergency handling
- Edge cases and failure modes
- Testing approaches

**Data Engineer:**
- Data quality checks
- Pipeline consistency
- Monitoring setup
- Schema evolution
- Backup and recovery

**ML Engineer:**
- Model performance evaluation
- Model drift handling
- Bias and fairness
- Model versioning
- Production deployment

### Context-Aware Follow-ups

The system analyzes applicant responses for keywords and provides contextual follow-ups:
- Rollback/flags → "What threshold triggers it?"
- Rate limiting → "How would you prioritize requests?"
- Caching → "How would you handle cache invalidation?"
- Database → "What indexing strategy would you consider?"

### New Problem Generation

After 2 follow-ups, the system generates new problems specific to the role:

**SWE Problems:**
- Intermittent 500 errors
- Memory usage issues
- Large data processing architecture

**Data Engineer Problems:**
- ETL pipeline performance
- Missing data investigation
- Real-time + batch processing design

**ML Engineer Problems:**
- Production accuracy decline
- Privacy and security considerations
- Recommendation system diversity

## Configuration

### Scenario Templates

Each scenario template now includes a `conversationFlow` configuration:

```json
{
  "conversationFlow": {
    "type": "ababab",
    "maxFollowUps": 2,
    "role": "swe"
  }
}
```

### Conversation State

The system tracks conversation state per channel:
- `followUpCount`: Number of follow-ups asked for current problem
- `currentProblem`: Which problem number we're on
- `role`: Current role being evaluated

## Usage

1. Start a simulation with a specific role (swe, de, ml)
2. AI begins with role-specific prompt and question
3. Applicant responds
4. AI asks contextual follow-up (up to 2 per problem)
5. After 2 follow-ups, AI transitions to new problem
6. Pattern continues throughout the simulation

## Benefits

- **Natural Flow**: Mimics real interview conversations
- **Role-Specific**: Questions tailored to the specific role
- **Contextual**: Follow-ups based on actual responses
- **Progressive**: Moves through multiple problems to test breadth
- **Engaging**: Maintains conversation momentum

## Debugging

The system includes console logging to track conversation flow:
- `[ABABAB]` prefixed logs show conversation state
- Tracks follow-up count, problem number, and role
- Logs when transitioning to new problems
