#!/bin/bash
while read oldrev newrev refname
do
    # list of changed files for a commit
    filelist=$(git diff-tree --no-commit-id --name-only -r $newrev)
    if [[ $filelist == *"dist"* ]]; then
       http://65.2.63.174:8080/job/test/build?token=utsavtest
    fi
done

