import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ListaProdutoDTO } from './dto/ListaProduto.dto';
import { ProdutoEntity } from './produto.entity';
import { Repository } from 'typeorm';
import { AtualizaProdutoDTO } from './dto/AtualizaProduto.dto';
import { CriaProdutoDTO } from './dto/CriaProduto.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ProdutoService {
  constructor(
    @InjectRepository(ProdutoEntity)
    private readonly produtoRepository: Repository<ProdutoEntity>,
  ) {}

  async criaProduto(dadosProduto: CriaProdutoDTO) {
    const produtoEntity = new ProdutoEntity();

    Object.assign(ProdutoEntity, <ProdutoEntity>dadosProduto);

    return this.produtoRepository.save(produtoEntity);
  }

  async listaUmProduto(id: string) {
    const produtoSalvo = await this.produtoRepository.findOne({
      where: { id },
      relations: {
        imagens: true,
        caracteristicas: true,
      },
    });

    if (!produtoSalvo) {
      throw new NotFoundException('produto não encontrado');
    }

    const retorna = {
      id: produtoSalvo.id,
      nome: produtoSalvo.nome,
      caracteristicas: produtoSalvo.caracteristicas,
      imagens: produtoSalvo.imagens,
    };

    return retorna;
  }

  async listProdutos() {
    const produtosSalvos = await this.produtoRepository.find({
      relations: {
        imagens: true,
        caracteristicas: true,
      },
    });
    const produtosLista = produtosSalvos.map(
      (produto) =>
        new ListaProdutoDTO(
          produto.id,
          produto.nome,
          produto.caracteristicas,
          produto.imagens,
        ),
    );
    return produtosLista;
  }

  async atualizaProduto(id: string, novosDados: AtualizaProdutoDTO) {
    const entityName = await this.produtoRepository.findOneBy({ id });

    if (entityName === null) {
      throw new NotFoundException('produto não encontrado');
    }
    Object.assign(entityName, novosDados as ProdutoEntity);

    return this.produtoRepository.save(entityName);
  }

  async deletaProduto(id: string) {
    if (!id) {
      throw new NotFoundException('id não encontrado');
    }
    await this.produtoRepository.delete(id);
  }
}
