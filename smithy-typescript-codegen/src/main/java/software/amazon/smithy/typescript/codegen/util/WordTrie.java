/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

public class WordTrie {
    private static final int MINIMUM_FOR_REUSE = 3;
    private final Map<String, WordTrie> path = new HashMap<>();
    private int count = 0;

    public WordTrie() {}

    /**
     * Records a count of all prefixes in the word list.
     */
    public void recordWords(List<String> words) {
        WordTrie trie;
        Map<String, WordTrie> cursor = path;
        count += 1;
        for (String word : words) {
            cursor.computeIfAbsent(word, (w) -> new WordTrie());
            trie = cursor.get(word);
            trie.count += 1;
            cursor = trie.path;
        }
    }

    /**
     * @return index of words where a prefix up to that point can be reused.
     */
    public int bestIndex(List<String> words) {
        WordTrie trie;
        Map<String, WordTrie> cursor = path;
        int index = 0;
        for (String word : words) {
            if (!cursor.containsKey(word)) {
                return -1;
            }
            trie = cursor.get(word);
            if (trie.count < MINIMUM_FOR_REUSE) {
                break;
            }
            index += 1;
            cursor = trie.path;
        }
        return index;
    }


    public int count() {
        return count;
    }

    public TreeSet<String> words() {
        return new TreeSet<>(path.keySet());
    }

    public WordTrie get(List<String> words) {
        WordTrie trie = this;
        Map<String, WordTrie> cursor = path;
        for (String word : words) {
            if (!cursor.containsKey(word)) {
                return null;
            }
            trie = cursor.get(word);
            cursor = trie.path;
        }
        return trie;
    }
}
