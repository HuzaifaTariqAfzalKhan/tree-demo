import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TodoItemNode } from './app.component';

@Injectable({
  providedIn: 'root'
})
export class TreeDataService {
  constructor(private http: HttpClient) { }

  fetchDataFromApi() {
    return this.http.get<TodoItemNode[]>('http://localhost:1337/api/custom-nested-data');
  }
}
