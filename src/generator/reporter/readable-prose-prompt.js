'use strict';

// Shared by Korean writing/repair and English translation to keep clarity rules aligned.
function readableProsePrompt() {
  return [
    'Reader-friendly technical prose: help a busy engineer who is unfamiliar with this particular topic understand it on the first reading. Keep the requested output language.',
    'Put the concrete change, who it affects, and its current status early. Use a descriptive headline and a self-contained lead; do not hide the main point behind a hook.',
    'Use short sentences and short paragraphs, with one main idea per paragraph. Aim for one to three sentences per paragraph when practical, without a rigid length quota or dropping necessary detail. Split chains of conditions into connected sentences and name the subject instead of using ambiguous pronouns.',
    'Explain an unfamiliar term in everyday language at first use, alongside its exact technical name or identifier. Explain what the component does before describing its failure or change. Avoid unexplained acronym chains, childish analogies, and invented background facts.',
    'For a bug fix, connect the triggering condition, previous failure, cause or mechanism established by the source, and changed behavior. For a tool or proposal, explain the supported task, requirements, limitations, and current availability. Do not invent a cause or force every article into the same template.',
    'Use optional, article-specific subheadings to answer a concrete reader question when helpful, within the existing body syntax and heading limits. Do not introduce new blocks or formatting. Let the body explain the lead and let the takeaway state a useful decision without repeating the same sentences.',
    'Simplify the explanation, never the claim: preserve exact versions, identifiers, numbers and units, negation, affected and unaffected paths, prerequisites, exceptions, and uncertainty. Keep each condition or qualification next to the claim it limits. Distinguish proposed, reviewed, merged, released, and included in a product build; do not infer later states.',
    'Keep source-confirmed results, attributed vendor claims, and suggested checks distinct. Absence of evidence means unconfirmed, not nonexistent: do not turn an unknown release date or missing product-build evidence into a claim that no release or product use exists. Describe a useful check through its input or operating condition and observable result only when supported; never invent completed tests, measured gains, or HAL effects to make the story easier or more actionable.',
    'Before returning the article, check that the reader can tell what changed, whether it applies to their work, and what remains unconfirmed. Restore any technical qualification lost while simplifying. These are writing instructions, not labels to print in the article.'
  ].join('\n');
}

module.exports = { readableProsePrompt };
