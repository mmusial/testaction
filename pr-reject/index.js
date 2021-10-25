const core = require('@actions/core');
const github = require('@actions/github');


const OWNER_REPO = process.env.GITHUB_REPOSITORY.split("/");
const OWNER = OWNER_REPO[0];
const REPO = OWNER_REPO[1];




async function main(payload) {
    try {
        if (!('pull_request' in payload)) {
            core.setFailed("No 'pull_request' in context payload");
            return;
        }
    
        const pull_request = payload.pull_request;
        const pull_number = pull_request.number;


        const repo_token = core.getInput('repo-token');
        const octokit = github.getOctokit(repo_token);

        await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
            owner: OWNER,
            repo: REPO,
            pull_number: pull_number,
            state: "closed"
          });

        // Comment why PR is closed
        const msg = core.getInput('message');
        await github.issues.createComment({...context.issue, body: msg})
    } catch (error) {
        core.setFailed(error.message);
    }
}


main(github.context.payload);