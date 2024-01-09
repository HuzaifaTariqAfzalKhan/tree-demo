
import { SelectionChange, SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, Injectable } from '@angular/core';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatTreeFlatDataSource, MatTreeFlattener, } from '@angular/material/tree';
import { BehaviorSubject } from 'rxjs';

/**
 * Node for to-do item
 */
export class TodoItemNode {
  children!: TodoItemNode[];
  item!: string;
  parent: any;
}

/** Flat to-do item node with expandable and level information */
export class TodoItemFlatNode {
  item!: string;
  level!: number;
  expandable!: boolean;
  deletable!: boolean;
  children: any;
}

/**
 * The Json object for to-do list data.
 */
const TREE_DATA: TodoItemNode[] = [
  {
    item: 'Groceries',
    children: [
      { item: 'Almond Meal flour', children: [], parent: null },
      { item: 'Organic eggs', children: [], parent: null },
      { item: 'Protein Powder', children: [], parent: null },
      {
        item: 'Fruits',
        children: [
          { item: 'Apple', children: [], parent: null },
          {
            item: 'Berries',
            children: [
              { item: 'Blueberry', children: [], parent: null },
              { item: 'Raspberry', children: [], parent: null },
            ],
            parent: null,
          },
          { item: 'Orange', children: [], parent: null },
        ],
        parent: null,
      },
    ],
    parent: null,
  },
  {
    item: 'Reminders',
    children: [
      { item: 'Cook dinner', children: [], parent: null },
      { item: 'Read the Material Design spec', children: [], parent: null },
      { item: 'Upgrade Application to Angular', children: [], parent: null },
    ],
    parent: null,
  },
];


/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
@Injectable()
export class ChecklistDatabase {
  dataChange = new BehaviorSubject<TodoItemNode[]>([]);

  get data(): TodoItemNode[] {
    return this.dataChange.value;
  }

  constructor() {
    this.initialize();
  }

  initialize() {
    // Notify the change.
    this.dataChange.next(TREE_DATA);
  }

  /** Add an item to to-do list */
  insertItem(parent: TodoItemNode, name: string) {
    if (parent.children) {
      parent.children.push({ item: name } as TodoItemNode);
      this.dataChange.next(this.data);
    }
  }

  updateItem(node: TodoItemNode, name: string) {
    node.item = name;
    this.dataChange.next(this.data);
  }
}

/**
 * @title Tree with checkboxes
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [ChecklistDatabase],
})
export class AppComponent {

  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap = new Map<TodoItemFlatNode, TodoItemNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap = new Map<TodoItemNode, TodoItemFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: TodoItemFlatNode | null = null;

  selectedNode: TodoItemFlatNode | null = null;

  /** The new item's name */
  newItemName = '';

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;



  /** The selection for checklist */
  checklistSelection = new SelectionModel<TodoItemFlatNode>(true /* multiple */);
  node: any;
  dataChange: any;
  data!: TodoItemNode[];

  constructor(private _database: ChecklistDatabase) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren,
    );
    this.treeControl = new FlatTreeControl<TodoItemFlatNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

    // Move the subscription inside the constructor
    _database.dataChange.subscribe(data => {
      this.dataSource.data = data; // This line triggers a refresh of the tree view
    });

    this._database.initialize();

    // Subscribe to the changed observable
    this.checklistSelection.changed.subscribe((change: SelectionChange<TodoItemFlatNode>) => {
      if (change.added.length > 0) {
        this.selectedNode = change.added[0];
      } else {
        this.selectedNode = null;
      }
    });
  }

  getLevel = (node: TodoItemFlatNode) => node.level;

  isExpandable = (node: TodoItemFlatNode) => node.expandable;

  getChildren = (node: TodoItemNode): TodoItemNode[] => node.children;

  hasChild = (_: number, _nodeData: TodoItemFlatNode) => _nodeData.expandable;

  hasNoContent = (_: number, _nodeData: TodoItemFlatNode) => _nodeData.item === '';


  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: TodoItemNode, level: number) => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode = existingNode && existingNode.item === node.item
      ? existingNode
      : new TodoItemFlatNode();
    flatNode.item = node.item;
    flatNode.level = level;

    // Check if the node has children and set expandable accordingly
    flatNode.expandable = !!node.children && node.children.length > 0;

    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }
  reloadNode(node: TodoItemFlatNode) {
    const result = this.treeControl.isExpandable(node);
    this.dataSource.data = [...this.dataSource.data];
    return result
  }

  /** Whether all the descendants of the node are selected. */
  descendantsAllSelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every(child => {
        return this.checklistSelection.isSelected(child);
      });
    return descAllSelected;
  }

  /** Whether part of the descendants are selected */
  descendantsPartiallySelected(node: TodoItemFlatNode): boolean {
    const descendants = this.treeControl.getDescendants(node);
    const result = descendants.some(child => this.checklistSelection.isSelected(child));
    return result && !this.descendantsAllSelected(node);
  }

  /** Toggle the to-do item selection. Select/deselect all the descendants node */
  todoItemSelectionToggle(node: TodoItemFlatNode, event: MatCheckboxChange): void {
    this.checklistSelection.toggle(node);

    if (event.checked) {
      const descendants = this.treeControl.getDescendants(node);
      this.checklistSelection.select(...descendants);
    } else {
      const descendants = this.treeControl.getDescendants(node);
      this.checklistSelection.deselect(...descendants);
    }

    // Force update for the parent
    this.checkAllParentsSelection(node);
  }


  /** Toggle a leaf to-do item selection. Check all the parents to see if they changed */
  todoLeafItemSelectionToggle(node: TodoItemFlatNode): void {
    this.checklistSelection.toggle(node);
    this.checkAllParentsSelection(node);
  }

  /* Checks all the parents when a leaf node is selected/unselected */
  checkAllParentsSelection(node: TodoItemFlatNode): void {
    let parent: TodoItemFlatNode | null = this.getParentNode(node);
    while (parent) {
      this.checkRootNodeSelection(parent);
      parent = this.getParentNode(parent);
    }
  }

  /** Check root node checked state and change it accordingly */
  checkRootNodeSelection(node: TodoItemFlatNode): void {
    const nodeSelected = this.checklistSelection.isSelected(node);
    const descendants = this.treeControl.getDescendants(node);
    const descAllSelected =
      descendants.length > 0 &&
      descendants.every(child => {
        return this.checklistSelection.isSelected(child);
      });
    if (nodeSelected && !descAllSelected) {
      this.checklistSelection.deselect(node);
    } else if (!nodeSelected && descAllSelected) {
      this.checklistSelection.select(node);
    }
  }

  /* Get the parent node of a node */
  getParentNode(node: TodoItemFlatNode): TodoItemFlatNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  /** Select the category so we can insert the new item. */
  addNewItem(node: TodoItemFlatNode): void {
    const newItemName = prompt('Enter the name for the new item', '');

    if (newItemName !== null) {
      const nestedNode = this.flatNodeMap.get(node);

      if (nestedNode) {
        const newItem: TodoItemNode = {
          item: newItemName, children: [],
          parent: undefined
        };

        if (!nestedNode.children) {
          nestedNode.children = [];
        }

        nestedNode.children.push(newItem);

        this._database.dataChange.next(this._database.data);
      }
    }
  }

  /** Save the node to database */
  saveNode(node: TodoItemFlatNode, itemValue: string) {
    const nestedNode = this.flatNodeMap.get(node);
    this._database.updateItem(nestedNode!, itemValue);
  }

  onDelete(node: TodoItemFlatNode): void {
    // Log the node to be deleted for debugging
    console.log('Deleting node:', node, this.dataSource.data);

    // Get the nested node from the flat node map
    const nestedNode = this.flatNodeMap.get(node);

    // Ensure that the nested node exists
    if (nestedNode) {
      // Find the parent node of the node to be deleted
      const parentNode = this.getParentNode(node);

      if (parentNode) {
        // Check if the parent node has children
        if (parentNode.children) {
          // Find the index of the node to be deleted in the parent's children array
          const index = parentNode.children.indexOf(nestedNode);

          // Check if the index is valid (greater than or equal to zero)
          if (index >= 0) {
            // Remove the node from the parent's children array
            parentNode.children.splice(index, 1);

            // Notify the data change to update the tree view
            this._database.dataChange.next(this._database.data);

            // Optionally, clear the selection (if you're using a selection model)
            this.checklistSelection.deselect(node);

            // Log a success message for debugging
            console.log('Node deleted successfully:', node);
          } else {
            // Log an error message for debugging (index not found)
            console.error('Node index not found:', node);
          }
        } else {
          // Log an error message for debugging (parent node has no children)
          console.error('Parent node has no children:', parentNode);
        }
      } else {
        // Log an error message for debugging (no parent node found)
        console.error('No parent node found for:', node);
      }

      // Filter out the deleted node from the tree data source
      this.dataSource.data = this.filterDeletedNode(this.dataSource.data, node);

      // Log a message for debugging
      console.log('Deleted node hidden:', node);
    } else {
      // Log an error message for debugging (nested node not found)
      console.error('Nested node not found:', node);
    }
  }

  // Function to filter out the deleted node and its descendants from the data source
  filterDeletedNode(data: TodoItemNode[], deletedNode: TodoItemFlatNode): TodoItemNode[] {
    return data.filter((node) => {
      if (node.item === deletedNode.item) {
        return false; // Exclude the deleted node
      }

      if (node.children) {
        // Recursively filter the descendants
        node.children = this.filterDeletedNode(node.children, deletedNode);
      }

      return true; // Include other nodes
    });
  }

  onDeleteWithChildren(node: TodoItemFlatNode): void {
    // Get the nested node from the flat node map
    const nestedNode = this.flatNodeMap.get(node);

    // Ensure that the nested node exists
    if (nestedNode) {
      // Find the parent node of the node to be deleted
      const parentNode = this.getParentNode(node);

      if (parentNode) {
        // Check if the parent node has children
        if (parentNode.children) {
          // Find the index of the node to be deleted in the parent's children array
          const index = parentNode.children.indexOf(nestedNode);

          // Check if the index is valid (greater than or equal to zero)
          if (index >= 0) {
            // Remove the node from the parent's children array
            parentNode.children.splice(index, 1);

            // Notify the data change to update the tree view
            this._database.dataChange.next(this._database.data);

            // Optionally, clear the selection (if you're using a selection model)
            this.checklistSelection.deselect(node);

            // Log a success message for debugging
            console.log('Node deleted successfully:', node);
          } else {
            // Log an error message for debugging (index not found)
            console.error('Node index not found:', node);
          }
        } else {
          // Log an error message for debugging (parent node has no children)
          console.error('Parent node has no children:', parentNode);
        }
      } else {
        // Log an error message for debugging (no parent node found)
        console.error('No parent node found for:', node);
      }

      // Filter out the deleted node and its descendants from the tree data source
      this.dataSource.data = this.filterDeletedNode(this.dataSource.data, node);

      // Log a message for debugging
      console.log('Deleted node and children:', node);
    } else {
      // Log an error message for debugging (nested node not found)
      console.error('Nested node not found:', node);
    }

    console.log('Deleting node:', node, this.dataSource.data);
  }

  // Function to filter out the deleted node and its descendants from the data source
  deleteNodeAndChildren(node: TodoItemFlatNode): void {
    // Filter the data and assign it to dataChange
    this.dataChange.next(this.filterPDeletedNode(this.data, node));
  }

  // Function to filter out the deleted node and its descendants from the data source
  private filterPDeletedNode(data: TodoItemNode[], deletedNode: TodoItemFlatNode): TodoItemNode[] {
    return data.filter((item) => {
      if (item === this.flatNodeMap.get(deletedNode)) {
        return false; // Exclude the deleted node
      }

      if (item.children) {
        // Recursively filter the descendants
        item.children = this.filterDeletedNode(item.children, deletedNode);
      }

      return true; // Include other nodes
    });
  }


  onEdit(node: TodoItemFlatNode): void {
    // Get the nested node from the flat node map
    const nestedNode = this.flatNodeMap.get(node);

    // Ensure that the nested node exists
    if (nestedNode) {
      // Prompt the user to enter a new name for the node
      const newName = prompt('Edit node name:', nestedNode.item);

      if (newName !== null) {
        // Update the item name with the new name
        nestedNode.item = newName;

        // Notify the data change to update the tree view
        this._database.dataChange.next(this._database.data);

        // Log a success message for debugging
        console.log('Node edited successfully:', node);
      }
    } else {
      // Log an error message for debugging (nested node not found)
      console.error('Nested node not found:', node);
    }
  }
}
