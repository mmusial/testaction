const core = require('@actions/core');
const github = require('@actions/github');


const OWNER_REPO = process.env.GITHUB_REPOSITORY.split("/");
const OWNER = OWNER_REPO[0];
const REPO = OWNER_REPO[1];





async function getCommit(octokit, commit_ref) {
    const result = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
        owner: OWNER,
        repo: REPO,
        ref: commit_ref
      });
    
    if (!('data' in result)) {
        return null;
    }

    return result.data;
}




async function getPathAuthorId(octokit, path)
{
    const result = await octokit.request('GET /repos/{owner}/{repo}/commits?per_page=1&path={path}', {
        owner: OWNER,
        repo: REPO,
        path: path
      });
    
    if (!('data' in result)) {
        return null;
    }
    if (result.data.length == 0) {
        return null;
    }

    const commit_info = result.data[0];
    if (!('commit' in commit_info)) {
        return null;
    }
    const commit = commit_info.commit;
    
    return await getCommitPullUserId(octokit, commit_info.sha);
}




async function getCommitPullUserId(octokit, commit_sha)
{
    const pull_info = await getPullForCommit(octokit, commit_sha);
    if (!('user' in pull_info)) {
        return null;
    }

    const pull_user = pull_info.user;
    if (!('id' in pull_user)) {
        return null;
    }

    return pull_user.id;
}




async function getPullForCommit(octokit, commit_sha)
{
    const result = await octokit.request('GET /repos/{owner}/{repo}/commits/{sha}/pulls', {
        owner: OWNER,
        repo: REPO,
        sha: commit_sha
      });

    if (result.data.length == 0) {
        return null;
    }
    
    return result.data[0];
}



async function GetPRFiles(octokit, pull_request)
{
    const base_ref = pull_request.base.label;
    const head_ref = pull_request.head.label;

    const result = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
        owner: OWNER,
        repo: REPO,
        per_page: 1,
        basehead: `${base_ref}...${head_ref}`
      });
    
    if (!('data' in result)) {
        return [];
    }
    if (!('files' in result.data)) {
        return [];
    }

    return result.data.files;
}



async function validateCommitFilesAuthor(octokit, pull_request) {
    const files = await GetPRFiles(octokit, pull_request);
    if (files.length == 0) {
        return false;
    }
    
    
    const author_id = pull_request.user.id;

    console.log(`pull author_id: ${author_id}`);

    const regex = /Scenarios\/.+\//;

    for (i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.filename;
        const status = file.status;
        
        
        const scenario_folder = filename.match(regex);
        console.log(`${filename} = ${scenario_folder}`);
        if (scenario_folder === null) {
            // TODO: Proper validation error about trying to merge into invalid path
            return false;
        }

        const original_scenario_folder_author_id = await getPathAuthorId(octokit, scenario_folder);
        console.log(`original author_id: ${author_id}`);
        
        const author_validation_result = (original_scenario_folder_author_id === null || original_scenario_folder_author_id === author_id);
        if (!author_validation_result) {
            // TODO: Proper validation error about original author doesn't match PR one
            return false;
        }



        // After author is validated
        // TODO:
        // 1) Check file name, only certain file name can be merged: info.json, scenario.community, download.manifest
        // 2) Validate file content as much as possible
        // 3) For status "adding", "updating" it's ok
        // 4) FOr status "deleting", we need to discuss if we want to allow. if yes, then only for all files, like whole folder.
    }

    return true;
}




async function main(payload) {
    try {
        if (!('pull_request' in payload)) {
            core.setFailed("No 'pull_request' in context payload");
            return;
        }
    
        const pull_request = payload.pull_request;
        if (!('user' in pull_request)) {
            core.setFailed("No 'user' in pull_request payload");
            return;
        }

        console.log(JSON.stringify(pull_request, undefined, 2))
        
        const repo_token = core.getInput('repo-token');
        const octokit = github.getOctokit(repo_token);

        const commit_files_validation_result = await validateCommitFilesAuthor(octokit, pull_request);
        console.log(`commit_files_validation_result: ${commit_files_validation_result}`);

        if (commit_files_validation_result !== true) {
            core.setFailed(`Pull-Request validation failed!`);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}


main(github.context.payload);