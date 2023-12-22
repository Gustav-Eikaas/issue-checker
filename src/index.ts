import { getInput, setSecret, setFailed, notice, warning } from "@actions/core";
type Octo = ReturnType<typeof getOctokit>;

export async function run() {
    try {
        const prNumber = parseInt(getInput("pr-number"));
        const token = getInput("token");
        setSecret(token);

        const client = getOctokit(token);
        checkIssues(client, prNumber);
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) setFailed(error.message);
    }
}

import { getOctokit, context } from "@actions/github";
import { info } from "@actions/core";

async function checkIssues(client: Octo, pr: number) {
    const pullRequests = await client.graphql(
        `
    query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          id
          number
          title
          timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
            __typename
            ... on  PullRequestTimelineItemsConnection{
              totalCount
              nodes {
                __typename
                ... on ConnectedEvent {
                  source {
                    __typename
                    ... on PullRequest {
                      number
                    }
                  }
                  subject {
                    __typename
                    ... on PullRequest {
                      number
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`,
        { owner: context.repo.owner, name: context.repo.repo, pr: pr }
    );

    const linkedIssues: number = (pullRequests as any).repository.pullRequest.timelineItems.totalCount;

    if (linkedIssues === 0) {
        info(`No linked issues adding comment to pr ${pr}`);
        warning(`No linked issues to pr ${pr}`);
        const comment = await client.rest.issues.createComment({
            issue_number: pr,
            body: noLinkedIssueMessage,
            owner: context.issue.owner,
            repo: context.issue.repo,
        });
        return;
    }
    info(`Linked issues: ${linkedIssues}`);
    notice(`Linked issues: ${linkedIssues}`);
}

run();
